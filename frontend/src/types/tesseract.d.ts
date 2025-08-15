declare module 'tesseract.js' {
	export interface TesseractWorker {
		load(): Promise<void>;
		loadLanguage(lang: string): Promise<void>;
		initialize(lang: string): Promise<void>;
		recognize(image: any): Promise<{ data: { text: string } }>;
		terminate(): Promise<void>;
	}
	export function createWorker(options?: any): Promise<TesseractWorker> | TesseractWorker;
	const _default: {
		createWorker: typeof createWorker;
	};
	export default _default;
}


