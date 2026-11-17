export type InsulinOnBoard = {
    units: number;
    measuredAt: Date;
};

export type InsulinDose = {
    id: string;
    units: number;
    deliveredAt: Date;
};

export type InsulinData = {
    insulinOnBoard: InsulinOnBoard | null;
    doses: InsulinDose[];
};
