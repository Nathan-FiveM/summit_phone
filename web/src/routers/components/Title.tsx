export default function Title(props: { title: string, mt?: string, mb?: string }) {
    return (
        <div style={{
            width: '15.052083333333334vw',
            color: '#FFF',
            fontFamily: "SFPro",
            fontSize: '1.5625vw',
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