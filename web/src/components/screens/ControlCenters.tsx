import { Swiper, SwiperSlide } from 'swiper/react';
//@ts-ignore
import 'swiper/css';

export default function ControlCenters() {
    return (
        <div>
            <Swiper
                direction={'vertical'}
                className="mySwiper"
                style={{
                    position: 'absolute',
                    left: '0.0vw',
                    width: '40%',
                    top: '0',
                }}
                initialSlide={2}
            >
                <SwiperSlide style={{ width: '100%', backgroundColor: 'green', }}>Slide 1</SwiperSlide>
                <SwiperSlide style={{ width: '100%', backgroundColor: 'purple', }}>Slide 2</SwiperSlide>
            </Swiper>
            <Swiper
                direction={'vertical'}
                className="mySwiper"
                style={{
                    position: 'absolute',
                    right: '0',
                    width: '50%'
                }}
                initialSlide={2}
            >
                <SwiperSlide style={{ width: '100%', backgroundColor: 'red', }}>Slide 1</SwiperSlide>
                <SwiperSlide style={{ width: '100%', backgroundColor: 'red', }}>Slide 2</SwiperSlide>
            </Swiper>
        </div>
    )
}