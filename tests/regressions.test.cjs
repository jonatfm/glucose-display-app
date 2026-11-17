const assert = require("node:assert/strict");
const {test} = require("node:test");

const {DEFAULT_APP_CONFIG} = require("../src/config/defaults.ts");
const {migrateAppConfig} = require("../src/config/migrations.ts");
const {isAppConfig} = require("../src/config/validation.ts");
const {getReusableNightscoutCredentialId, createNightscoutReadingsUrl} =
    require("../src/connectors/nightscout/nightscoutUrl.ts");
const {parseXdripReadings} = require("../src/connectors/xdrip/xdripParser.ts");
const {parseXdripInsulinOnBoard} = require("../src/insulin/parser.ts");
const {formatInsulin, layoutInsulinDoses} = require("../src/insulin/display.ts");
const {formatGlucose} = require("../src/glucose/units.ts");
const {getGlucoseDisplayStatus} = require("../src/glucose/displayStatus.ts");
const {fetchReadingHistory} = require("../src/connectors/readingHistory.ts");
const {createXdripConnector} = require("../src/connectors/xdrip/xdripConnector.ts");

// Only the device credential storage boundary needs a stub.
const credentialsPath = require.resolve("../src/connectors/nightscout/nightscoutCredentials.ts");
require.cache[credentialsPath] = {
    id: credentialsPath, filename: credentialsPath, loaded: true,
    exports: {loadNightscoutToken: async () => "saved-test-token"},
};
const {createNightscoutConnector} = require("../src/connectors/nightscout/nightscoutConnector.ts");

const NOW = Date.parse("2026-11-17T12:00:00Z");
const storedServer = {
    type: "nightscout", baseUrl: "https://example.com/ns",
    authentication: "access-token", credentialId: "saved-credential",
};
const readingAt = (timestamp) => ({
    measuredAt: new Date(timestamp), valueMgDl: 123, deltaMgDl: 0, direction: "Flat",
});

test("stored credentials can only be reused for the same normalized server", () => {
    for (const url of ["https://example.com/ns", "https://EXAMPLE.com:443/ns/",
        "https://example.com/ns/api/v1/entries/sgv.json"]) {
        assert.equal(getReusableNightscoutCredentialId(storedServer, url), "saved-credential");
    }
    for (const url of ["https://other.example/ns", "https://example.com/other",
        "https://example.com:444/ns", "http://example.com/ns", "invalid"]) {
        assert.equal(getReusableNightscoutCredentialId(storedServer, url), null);
    }
    assert.equal(getReusableNightscoutCredentialId({
        ...storedServer, authentication: "none", credentialId: null,
    }, storedServer.baseUrl), null);
});

test("xDrip IOB accepts dot and comma decimals independently of formatting", () => {
    for (const value of [1.25, "1.25", "1,25"]) {
        assert.equal(parseXdripInsulinOnBoard({
            bgs: [{iob: value}], status: [{now: NOW}],
        }).units, 1.25);
    }
    for (const value of ["", "unknown", "1,2,3", null, Infinity]) {
        assert.equal(parseXdripInsulinOnBoard({
            bgs: [{iob: value}], status: [{now: NOW}],
        }), null);
    }
    assert.equal(formatInsulin(1.25, "."), "1.25 U");
    assert.equal(formatInsulin(1.25, ","), "1,25 U");
    assert.equal(formatInsulin(0, ","), "0 U");
    assert.equal(formatGlucose(123, "mmol/L", "."), "6.8");
    assert.equal(formatGlucose(123, "mmol/L", ","), "6,8");
    assert.equal(formatGlucose(123, "mg/dL", ","), "123");
});

test("migration preserves existing preferences and validates the saved decimal choice", () => {
    const legacy = structuredClone(DEFAULT_APP_CONFIG);
    legacy.schemaVersion = 5;
    legacy.display.showInsulinOnBoard = true;
    delete legacy.display.decimalSeparator;
    const migrated = migrateAppConfig(legacy);
    assert.equal(isAppConfig(migrated), true);
    assert.equal(migrated.display.decimalSeparator, ".");
    assert.equal(migrated.display.showInsulinOnBoard, true);
    assert.deepEqual(migrated.source, legacy.source);
    migrated.display.decimalSeparator = ",";
    assert.equal(isAppConfig(migrated), true);
    assert.equal(migrateAppConfig(migrated).display.decimalSeparator, ",");
    migrated.display.decimalSeparator = ";";
    assert.equal(isAppConfig(migrated), false);

    legacy.schemaVersion = 4;
    delete legacy.display.showInsulinOnBoard;
    assert.equal(isAppConfig(migrateAppConfig(legacy)), true);
});

test("individual dose labels preserve each amount and timestamp without overlapping in a row", () => {
    const doses = Array.from({length: 36}, (_, i) => ({
        id: String(i), units: (i + 1) / 10, deliveredAt: new Date(NOW - i * 300000),
    }));
    for (const width of [40, 320, 768]) {
        const markers = layoutInsulinDoses(doses, NOW, 10800, width);
        assert.equal(markers.length, doses.length);
        assert.equal(new Set(markers.map((marker) => marker.dose.id)).size, doses.length);
        const rowEnds = new Map();
        for (const marker of markers) {
            assert.equal(marker.dose.units, doses[Number(marker.dose.id)].units);
            assert.equal(marker.fraction,
                1 - (NOW - marker.dose.deliveredAt.getTime()) / 10800000);
            assert.ok(marker.labelLeft >= 0);
            assert.ok(marker.labelLeft + marker.labelWidth <= width);
            if (rowEnds.has(marker.row)) {
                assert.ok(marker.labelLeft >= rowEnds.get(marker.row) + 4);
            }
            rowEnds.set(marker.row, marker.labelLeft + marker.labelWidth);
        }
        assert.ok(rowEnds.size > 1);
    }
    assert.deepEqual(layoutInsulinDoses(doses, NOW, 10800, 0), []);
});

test("xDrip rejects corrupt and far-future timestamps instead of displaying them as live", () => {
    for (const date of ["", " ", 0, -1, 1e20, NOW + 300001, null]) {
        assert.deepEqual(parseXdripReadings([{date, sgv: 123}], NOW), []);
    }
    for (const sgv of ["", -1, 0, 19, 601, null]) {
        assert.deepEqual(parseXdripReadings([{date: NOW, sgv}], NOW), []);
    }
    const readings = parseXdripReadings([{date: NOW, sgv: 123, delta: "0.5"}], NOW);
    assert.equal(readings[0].deltaMgDl, 0.5);
    assert.equal(getGlucoseDisplayStatus({
        status: "online", latestReading: readingAt(NaN), now: NOW, staleAfterSeconds: 600,
    }), "STALE");
});

test("history expands to cover one-minute readings and reuses the learned count", async () => {
    const source = Array.from({length: 500}, (_, i) => readingAt(NOW - i * 60000));
    const calls = [];
    const readBatch = async (count) => {
        calls.push(count);
        return {readings: source.slice(0, count), receivedCount: Math.min(count, source.length)};
    };
    const request = {historySeconds: 10800, minimumReadings: 2, signal: new AbortController().signal};
    const result = await fetchReadingHistory(request, readBatch, {initialCount: 2, canPage: false}, NOW);
    assert.ok(result.readings[0].measuredAt.getTime() <= NOW - 10800000);
    assert.ok(calls.length > 1);
    calls.length = 0;
    await fetchReadingHistory(request, readBatch, {initialCount: result.requestedCount, canPage: false}, NOW);
    assert.equal(calls.length, 1);
    calls.length = 0;
    await fetchReadingHistory({...request, historySeconds: 0}, readBatch,
        {initialCount: result.requestedCount, canPage: false}, NOW);
    assert.deepEqual(calls, [2]);
});

test("history stops when sources run out or stop returning older timestamps", async () => {
    const request = {historySeconds: 10800, minimumReadings: 2, signal: new AbortController().signal};
    let calls = 0;
    await fetchReadingHistory(request, async () => {
        calls++;
        return {readings: [readingAt(NOW)], receivedCount: 1};
    }, {initialCount: 2, canPage: false}, NOW);
    assert.equal(calls, 1);
    calls = 0;
    await fetchReadingHistory(request, async (count) => {
        calls++;
        return {readings: [readingAt(NOW)], receivedCount: count};
    }, {initialCount: 2, canPage: true}, NOW);
    assert.equal(calls, 2);
});

test("Nightscout pages older history beyond one batch without dropping latest readings", async () => {
    const source = Array.from({length: 1400}, (_, i) => readingAt(NOW - i * 60000));
    const calls = [];
    const request = {historySeconds: 1200 * 60, minimumReadings: 2, signal: new AbortController().signal};
    const result = await fetchReadingHistory(request, async (count, before) => {
        calls.push({count, before});
        const readings = source.filter((r) => before === undefined || r.measuredAt.getTime() <= before).slice(0, count);
        return {readings, receivedCount: readings.length};
    }, {initialCount: 1000, canPage: true}, NOW);
    assert.equal(calls.length, 2);
    assert.ok(calls[1].before < NOW);
    assert.equal(result.readings.at(-1).measuredAt.getTime(), NOW);
    assert.ok(result.readings[0].measuredAt.getTime() <= NOW - request.historySeconds * 1000);
    const url = createNightscoutReadingsUrl(storedServer.baseUrl, 1000, calls[1].before);
    assert.equal(url.pathname, "/ns/api/v1/entries/sgv.json");
    assert.equal(url.searchParams.get("find[date][$lte]"), String(calls[1].before));
});

test("both connectors request a full three-hour window with one-minute source data", async (t) => {
    const now = Date.now();
    const source = Array.from({length: 500}, (_, i) => ({date: now - i * 60000, sgv: 123, delta: 0}));
    const requests = [];
    t.mock.method(globalThis, "fetch", async (input, init) => {
        const url = new URL(input);
        requests.push({url, init});
        return new Response(JSON.stringify(source.slice(0, Number(url.searchParams.get("count")))), {status: 200});
    });
    const connectors = [
        createXdripConnector({type: "xdrip", baseUrl: "http://127.0.0.1:17580"}),
        createNightscoutConnector(storedServer),
    ];
    for (const connector of connectors) {
        const readings = await connector.getReadings({
            historySeconds: 10800, minimumReadings: 2, signal: new AbortController().signal,
        });
        assert.ok(readings[0].measuredAt.getTime() <= now - 10800000);
        assert.equal(readings.at(-1).measuredAt.getTime(), now);
    }
    for (const {url, init} of requests.filter(({url}) => url.protocol === "https:")) {
        assert.equal(init.headers["api-secret"], "saved-test-token");
        assert.equal(init.redirect, "error");
        assert.ok(!url.toString().includes("saved-test-token"));
    }
});

test("an empty older Nightscout page preserves the available glucose history", async (t) => {
    const now = Date.now();
    const source = Array.from({length: 1000}, (_, i) => ({date: now - i * 60000, sgv: 123}));
    let calls = 0;
    t.mock.method(globalThis, "fetch", async (input) => {
        calls++;
        const url = new URL(input);
        const payload = url.searchParams.has("find[date][$lte]")
            ? []
            : source.slice(0, Number(url.searchParams.get("count")));
        return new Response(JSON.stringify(payload), {status: 200});
    });
    const readings = await createNightscoutConnector(storedServer).getReadings({
        historySeconds: 24 * 3600, minimumReadings: 2, signal: new AbortController().signal,
    });
    assert.equal(readings.length, 1000);
    assert.equal(readings.at(-1).measuredAt.getTime(), now);
    assert.ok(calls <= 4);
});
