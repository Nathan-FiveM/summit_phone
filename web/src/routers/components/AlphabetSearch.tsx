export default function AlphabetSearch(props: { onClick(letter: string): void }) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '0.83vh',
            height: '0.83vh',
            position: 'absolute',
            alignItems: 'center',
            gap: '0.46vh',
            right: '0.46vh',
            top: '22%',
            color: '#0A84FF',
            textAlign: 'center',
            fontFamily: "SFPro",
            fontSize: '0.93vh',
            fontStyle: 'normal',
            fontWeight: 700,
            lineHeight: '118.596%',
            letterSpacing: '0.03vh',
        }}>
            <div className='clickanimation' onClick={() => props.onClick('A')}>A</div>
            <div className='clickanimation' onClick={() => props.onClick('B')}>B</div>
            <div className='clickanimation' onClick={() => props.onClick('C')}>C</div>
            <div className='clickanimation' onClick={() => props.onClick('D')}>D</div>
            <div className='clickanimation' onClick={() => props.onClick('E')}>E</div>
            <div className='clickanimation' onClick={() => props.onClick('F')}>F</div>
            <div className='clickanimation' onClick={() => props.onClick('G')}>G</div>
            <div className='clickanimation' onClick={() => props.onClick('H')}>H</div>
            <div className='clickanimation' onClick={() => props.onClick('I')}>I</div>
            <div className='clickanimation' onClick={() => props.onClick('J')}>J</div>
            <div className='clickanimation' onClick={() => props.onClick('K')}>K</div>
            <div className='clickanimation' onClick={() => props.onClick('L')}>L</div>
            <div className='clickanimation' onClick={() => props.onClick('M')}>M</div>
            <div className='clickanimation' onClick={() => props.onClick('N')}>N</div>
            <div className='clickanimation' onClick={() => props.onClick('O')}>O</div>
            <div className='clickanimation' onClick={() => props.onClick('P')}>P</div>
            <div className='clickanimation' onClick={() => props.onClick('Q')}>Q</div>
            <div className='clickanimation' onClick={() => props.onClick('R')}>R</div>
            <div className='clickanimation' onClick={() => props.onClick('S')}>S</div>
            <div className='clickanimation' onClick={() => props.onClick('T')}>T</div>
            <div className='clickanimation' onClick={() => props.onClick('U')}>U</div>
            <div className='clickanimation' onClick={() => props.onClick('V')}>V</div>
            <div className='clickanimation' onClick={() => props.onClick('W')}>W</div>
            <div className='clickanimation' onClick={() => props.onClick('X')}>X</div>
            <div className='clickanimation' onClick={() => props.onClick('Y')}>Y</div>
            <div className='clickanimation' onClick={() => props.onClick('Z')}>Z</div>
        </div >
    )
}