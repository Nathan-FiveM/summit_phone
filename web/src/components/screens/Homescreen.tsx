import { Transition } from "@mantine/core";

export default function HomeScreen() {
    return (
        <Transition
            mounted={false}
            transition="slide-up"
            duration={400}
            timingFunction="ease"
        >
            {(styles) => <div style={styles} className="homescreen">
                <div >
                    Homescreen
                </div>
            </div>}
        </Transition>
    )
}