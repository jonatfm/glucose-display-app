import { View } from "react-native";

export default function MainView({ children }: { children: React.ReactNode }) {
    return (
        <View>
            {children}
        </View>
    )
}