import { TextInput } from "@mantine/core";
import { fetchNui } from "../../hooks/fetchNui";

export default function Searchbar(props: { mt: string, value: string, onChange: (e: string) => void }) {
    return (
        <TextInput
            styles={{
                input: {
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    width: '26.76vh',
                    height: '2.31vh',
                    minHeight: '2.31vh',
                    outline: 'none',
                    border: 'none',
                    fontFamily: 'SFPro',

                    fontWeight: 500,
                    fontSize: '1.39vh',
                    lineHeight: '1.67vh',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'rgb(255, 255, 255)',
                },
            }}
            className="searchbar"
            leftSection={
                <svg width="1.30vh" height="1.30vh" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.8358 12.9867L9.94207 9.05754C10.704 8.10258 11.1634 6.89248 11.1634 5.57667C11.1634 2.49675 8.66604 0 5.5817 0C2.49737 0 0 2.50039 0 5.58032C0 8.66024 2.49737 11.157 5.5817 11.157C6.91606 11.157 8.1374 10.6904 9.09989 9.91044L12.9681 13.8141C13.0847 13.938 13.2452 14 13.4019 14C13.5514 14 13.7009 13.9453 13.8139 13.836C14.0545 13.6064 14.0618 13.2273 13.8358 12.9867ZM5.5817 9.95782C4.4114 9.95782 3.31038 9.50221 2.48278 8.67482C1.65519 7.84743 1.19946 6.74668 1.19946 5.58032C1.19946 4.41031 1.65519 3.30955 2.48278 2.48581C3.31038 1.65842 4.4114 1.20281 5.5817 1.20281C6.752 1.20281 7.85303 1.65842 8.68062 2.48581C9.50822 3.3132 9.96394 4.41395 9.96394 5.58032C9.96394 6.75033 9.50822 7.85108 8.68062 8.67482C7.85303 9.50221 6.752 9.95782 5.5817 9.95782Z" fill="white" fillOpacity="0.3" />
                </svg>
            }
            value={props.value}
            onChange={(e) => props.onChange(e.currentTarget.value)}
            placeholder="Search"
            mt={props.mt}
            onFocus={() => fetchNui('disableControls', true)}
            onBlur={() => fetchNui('disableControls', false)}
        />
    )
}