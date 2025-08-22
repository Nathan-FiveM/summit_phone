export default function Title(props: { title: string, mt?: string, mb?: string, fontSize?: string }) {
    return (
        <div style={{
            width: '26.76vh',
            color: '#FFF',
            fontFamily: "SFPro",
            fontSize: props.fontSize ?? '2.78vh',
            fontStyle: 'normal',
            fontWeight: 700,
            lineHeight: 'normal',
            marginTop: props.mt,
            marginBottom: props.mb
        }}>
            {props.title}
        </div>
    )
}