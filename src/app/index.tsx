import { Text, View } from "react-native";
import MainView from "../components/MainView";
import { AppConfigProvider } from "../config/AppConfigProvider";

export default function App() {
    return (
        <AppConfigProvider>
            <MainView />
        </AppConfigProvider>
    )
}