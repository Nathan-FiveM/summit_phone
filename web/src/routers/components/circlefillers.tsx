export default function CircleFillers(props: { mt: string; type: number; length: number, error: boolean }) {

    return (
        <div className="circleFillers" style={{ marginTop: props.mt }}>
            {Array.from({ length: props.type }, (_, i) => {
                return (
                    <svg
                        key={i}
                        xmlns="http://www.w3.org/2000/svg"
                        width="1.40vh"
                        height="1.40vh"
                        viewBox="0 0 13 13"
                        fill="none"
                        aria-hidden="true"
                        className={props.error ? 'vibrateAnimation' : ''}
                    >
                        <circle
                            cx="6.79126"
                            cy="6.79138"
                            r="5.5"
                            fill="#D9D9D9"
                            stroke="#D9D9D9"
                            style={{ transition: 'all 0.3s ease' }}
                            fillOpacity={i < props.length ? 1 : 0}
                        />
                    </svg>
                );
            })}
        </div>
    );
}
