import { Swiper, SwiperSlide } from 'swiper/react';
//@ts-ignore
import 'swiper/css';
import { useState } from 'react';

export default function ControlCenters() {
    const [index, setIndex] = useState(0);
    return (
        <div style={{
            pointerEvents: index === 1 ? "none" : "all",
        }}>
            <Swiper
                grabCursor={true}
                style={{
                    width: "100%", height: "100%", position: "absolute", pointerEvents: "none", zIndex: 10, left: 0
                }}
                direction={"vertical"}
                initialSlide={1}
                followFinger={true}
                autoHeight={false}
                touchEventsTarget={"container"}
                onSlideChange={(swipe) => setIndex(swipe.realIndex)}
            >
                <SwiperSlide>
                    <div className="dropdownScreen" style={{
                        width: "100%",
                        height: "100%",
                        background: "rgba(255, 255, 255, 0.904)",
                        marginBottom: "0.5vh",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        alignItems: "center",
                        pointerEvents: "all",
                    }}>

                    </div>
                </SwiperSlide>
                <SwiperSlide >
                    <div className="lineContainerExternal" style={{
                        width: "5.7vw",
                        height: "1.6vw",
                        pointerEvents: "all",
                    }}>

                    </div>
                </SwiperSlide>
            </Swiper>
            <Swiper
                grabCursor={true}
                style={{
                    width: "100%", height: "100%", position: "absolute", pointerEvents: "none", zIndex: 10, right: 0,
                }}
                direction={"vertical"}
                initialSlide={1}
                followFinger={true}
                autoHeight={false}
                touchEventsTarget={"container"}
                onSlideChange={(swipe) => setIndex(swipe.realIndex)}
            >
                <SwiperSlide>
                    <div className="dropdownScreenX" style={{
                        width: "100%",
                        height: "100%",
                        background: "rgba(255, 255, 255, 0.904)",
                        marginBottom: "0.5vh",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        alignItems: "center",
                        pointerEvents: "all",
                    }}>

                    </div>
                </SwiperSlide>
                <SwiperSlide >
                    <div className="lineContainerExternalX" style={{
                        width: "5.8vw",
                        position: "absolute",
                        right: "0",
                        height: "1.6vw",
                        pointerEvents: "all",
                    }}>

                    </div>
                </SwiperSlide>
            </Swiper>
        </div>
    )
}