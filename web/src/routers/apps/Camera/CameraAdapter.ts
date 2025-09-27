
//@ts-ignore
import { CfxTexture, LinearFilter, Mesh, NearestFilter, OrthographicCamera, PlaneBufferGeometry, RGBAFormat, Scene, ShaderMaterial, UnsignedByteType, WebGLRenderTarget, WebGLRenderer } from "@citizenfx/three";
const uploadUrl = ""; //? default upload url
const uploadField = ""; //? default upload field
var isAnimated = false;
var scId = 0;
export function Delay(ms: number) {
    return new Promise(res => setTimeout(res, ms));
};

// from https://stackoverflow.com/a/12300351
export function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([ab], { type: mimeString });
    return blob;
}

let CANVAS_WIDTH = 344;
let CANVAS_HEIGHT = 570;

class GameRender {
    public material: ShaderMaterial;
    public renderer: WebGLRenderer;
    public rtTexture: WebGLRenderTarget;
    public sceneRTT: Scene;
    public cameraRTT: OrthographicCamera;
    public gameTexture: CfxTexture;
    public canvas: HTMLCanvasElement;


    initializeAgain() {
        const cameraRTT = new OrthographicCamera(CANVAS_WIDTH / -2, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT / -2, -10000, 10000);
        cameraRTT.position.z = 0;
        cameraRTT.setViewOffset(CANVAS_WIDTH, CANVAS_HEIGHT, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const sceneRTT = new Scene();

        const rtTexture = new WebGLRenderTarget(CANVAS_WIDTH, CANVAS_HEIGHT, { minFilter: LinearFilter, magFilter: NearestFilter, format: RGBAFormat, type: UnsignedByteType });
        const gameTexture = new CfxTexture();
        gameTexture.needsUpdate = true;

        const material = new ShaderMaterial({
            uniforms: { "tDiffuse": { value: gameTexture } },
            vertexShader: `
			varying vec2 vUv;

			void main() {
				vUv = vec2(uv.x, 1.0-uv.y);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
            `,
            fragmentShader: `
			varying vec2 vUv;
			uniform sampler2D tDiffuse;

			void main() {
				gl_FragColor = texture2D(tDiffuse, vUv);
			}
            `
        });

        this.material = material;

        const plane = new PlaneBufferGeometry(CANVAS_WIDTH, CANVAS_HEIGHT);
        const quad = new Mesh(plane, material);
        quad.position.z = -100;
        sceneRTT.add(quad);

        const renderer = new WebGLRenderer();
        renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
        renderer.autoClear = false;

        let appendArea = document.createElement("div");
        appendArea.id = "three-game-render";

        document.body.append(appendArea);

        appendArea.appendChild(renderer.domElement);
        appendArea.style.display = 'none';

        this.renderer = renderer;
        this.rtTexture = rtTexture;
        this.sceneRTT = sceneRTT;
        this.cameraRTT = cameraRTT;
        this.gameTexture = gameTexture;

        this.animate = this.animate.bind(this);

        requestAnimationFrame(this.animate);
    }

    resize(screenshot: any) {
        let cameraRTT: OrthographicCamera;
        if (screenshot === true) {
            CANVAS_WIDTH = window.innerWidth;
            CANVAS_HEIGHT = window.innerHeight;
            const width = Math.floor(CANVAS_HEIGHT * 17 / 10);
            cameraRTT = new OrthographicCamera(CANVAS_WIDTH / -2, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT / -2, -10000, 10000);
            cameraRTT.setViewOffset(CANVAS_WIDTH, CANVAS_HEIGHT, 0, 0, width, CANVAS_HEIGHT);
        } else {
            CANVAS_WIDTH = Math.floor(window.innerWidth / 5.58); // Return 344 value
            CANVAS_HEIGHT = Math.floor(window.innerHeight / 1.894); // Return 570 value
            const width = Math.floor(CANVAS_HEIGHT * 4 / 19);
            cameraRTT = new OrthographicCamera(CANVAS_WIDTH / -2, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT / -2, -10000, 10000);
            cameraRTT.setViewOffset(CANVAS_WIDTH, CANVAS_HEIGHT, CANVAS_WIDTH / 3.8, 0, width, CANVAS_HEIGHT);
        }

        this.cameraRTT = cameraRTT;

        const sceneRTT = new Scene();

        const plane = new PlaneBufferGeometry(CANVAS_WIDTH, CANVAS_HEIGHT);
        const quad = new Mesh(plane, this.material);
        quad.position.z = -100;
        sceneRTT.add(quad);

        this.sceneRTT = sceneRTT;

        this.rtTexture = new WebGLRenderTarget(CANVAS_WIDTH, CANVAS_HEIGHT, { minFilter: LinearFilter, magFilter: NearestFilter, format: RGBAFormat, type: UnsignedByteType });

        this.renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    async getStream(): Promise<MediaStream> {
        const cameraCanvas = this.canvas;
        cameraCanvas.width = CANVAS_WIDTH;
        cameraCanvas.height = CANVAS_HEIGHT;

        const context = cameraCanvas.getContext("2d");

        if (!context) {
            throw new Error("Failed to get 2D context");
        }

        const videoStream = (cameraCanvas as any).captureStream(55);
        return videoStream;
    }

    async captureImage(): Promise<string> {
        const cameraCanvas = this.canvas;
        return cameraCanvas.toDataURL("image/webp", 0.5);
    }

    animate() {
        requestAnimationFrame(this.animate);
        if (isAnimated) {
            this.renderer.clear();
            this.renderer.render(this.sceneRTT, this.cameraRTT, this.rtTexture, true);
            const read = new Uint8Array(CANVAS_WIDTH * CANVAS_HEIGHT * 4);
            this.renderer.readRenderTargetPixels(this.rtTexture, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, read);

            this.canvas.width = CANVAS_WIDTH;
            this.canvas.height = CANVAS_HEIGHT;

            const d = new Uint8ClampedArray(read.buffer);

            const cxt = this.canvas.getContext('2d');
            const imageData = new ImageData(d, CANVAS_WIDTH, CANVAS_HEIGHT);
            cxt.putImageData(imageData, 0, 0);
        }
    }

    createTempCanvas() {
        this.canvas = document.createElement("canvas");
        this.canvas.style.display = 'inline';
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
    }

    renderToTarget() {
        this.canvas = document.createElement("canvas");
        isAnimated = true;
    }

    requestScreenshot = (url, field) => new Promise(async (res) => {
        console.time("requestScreenshot");
        this.createTempCanvas();
        url = url ? url : uploadUrl;
        field = field ? field : uploadField;
        isAnimated = true;
        await Delay(10);
        const imageURL = this.canvas.toDataURL("image/jpeg", 0.92);
        const formData = new FormData();
        formData.append(field, dataURItoBlob(imageURL), `screenshot.png`);

        fetch(url, {
            method: 'POST',
            mode: 'cors',
            body: formData
        })
            .then(response => response.text())
            .then((text: any) => {
                const textX = JSON.parse(text);
                if (textX.attachments[0].url) {
                    res(textX.attachments[0]);
                } else {
                    res(false);
                }
                scId++;
                this.canvas.remove();
            });
    })

    /* requestScreenshot = (url) => new Promise(async (res) => {
        console.time("requestScreenshot");
        this.createTempCanvas();
        url = url ? url : uploadUrl;

        isAnimated = true;
        await Delay(10);
        const imageURL = this.canvas.toDataURL("image/webp", 1).slice(23);
        const imageURL = this.canvas.toDataURL("image/jpeg", 1);

        const response = await axios.post("https://api.vormirstudios.com/upload", { file: imageURL, filename: 'screenshot.webp' }, {
            headers: {
                'Content-Type': 'application/json',
                'Token': 'MjZh67iE63&m@3KtLZKixI5Xl57d#whL#8R@A3'
            },
        }).then(async(res) => {
            console.timeEnd("requestScreenshot");
            console.log(JSON.stringify(await res.data));
            scId++;
            isAnimated = false;
            this.canvas.remove();
            //@ts-ignore
            this.canvas = false;
        }).catch((error) => {
            console.log(error);
        });

        const formData = new FormData();
        formData.append('files[]', dataURItoBlob(imageURL), `screenshot.jpeg`);

        const response = await axios.post(url, formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        }).then(async (res) => {
            console.timeEnd("requestScreenshot");
            console.log(JSON.stringify(await res.data));
            scId++;
            isAnimated = false;
            this.canvas.remove();
            //@ts-ignore
            this.canvas = false;
        }).catch((error) => {
            console.log(error);
        });

        fetch(url, {
            method: 'POST',
            mode: 'cors',
            body: formData
        })
            .then(response => response.text())
            .then((text: any) => {
                text = JSON.parse(text);
                if (text.success) {
                    console.timeEnd("requestScreenshot");
                    res(text.files[0]);
                } else {
                    res(false);
                }
                scId++;
                isAnimated = false;
                this.canvas.remove();
                this.canvas = null;
            });
    }) */

    stop() {
        isAnimated = false;
        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
        }
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss();
            this.renderer.domElement.remove();
            this.renderer = null;
        }
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }
        if (this.rtTexture) {
            this.rtTexture.dispose();
            this.rtTexture = null;
        }
        if (this.gameTexture) {
            this.gameTexture.dispose();
            this.gameTexture = null;
        }
        this.sceneRTT = null;
        this.cameraRTT = null;
        window.removeEventListener('resize', () => this.resize(false));
    }
}

export const MainRender = new GameRender();