﻿declare var Blazor: IBlazor;
declare var DotNet: IDotNet;

interface IBlazor {
    platform: IBlazorPlatform;
}
interface MethodHandle { MethodHandle__DO_NOT_IMPLEMENT: any }
interface System_Object { System_Object__DO_NOT_IMPLEMENT: any }
interface System_Array<T> extends System_Object { System_Array__DO_NOT_IMPLEMENT: any }

interface IBlazorPlatform {
    toJavaScriptString(pointer: any): string;
    toDotNetString(jsString: string): any;
    toUint8Array(array: System_Array<any>): Uint8Array;
    findMethod(assemblyName: string, namespace: string, className: string, methodName: string): MethodHandle;
    callMethod(method: MethodHandle, target: System_Object | null, args: (System_Object | null)[]): System_Object;
}

interface IReadFileParams {
    fileRef: number;
    position: number;
    count: number;
    callBackId: number;
    bufferOffset: number;
};

interface IFileInfo {
    name: string;
    size: number;
    type: string;
    lastModified: number;
};

interface IDotNetBuffer {
    toUint8Array(): Uint8Array;
}

interface IDotNet {
    invokeMethodAsync<T>(assemblyName: string, methodIdentifier: string, ...args: any[]): Promise<T>
}

class FileReaderComponent {
    private readonly assembly = "Blazor.FileReader";
    private readonly namespace = "Blazor.FileReader";
    private readonly className = "FileReaderJsInterop";

    private newFileStreamReference: number = 0;
    private readonly fileStreams: { [reference: number]: File } = {};
    private readonly dragElements: Map<HTMLElement, EventListenerOrEventListenerObject> = new Map();
    private readonly elementDataTransfers: Map<HTMLElement, FileList> = new Map();
    private static getStreamBuffer: MethodHandle;

    public RegisterDropEvents = (element: HTMLElement, additive : boolean): boolean => {

        const handler = (ev: DragEvent) => {
            this.PreventDefaultHandler(ev);
            if (ev.target instanceof HTMLElement) {
                let list = ev.dataTransfer.files;

                if (additive) {
                    const existing = this.elementDataTransfers.get(ev.target);
                    if (existing != null && existing.length > 0) {
                        list = new FileReaderComponent.ConcatFileList(existing, list);
                    }
                }
                
                this.elementDataTransfers.set(ev.target, list);
            }
        };

        this.dragElements.set(element, handler);
        element.addEventListener("drop", handler);
        element.addEventListener("dragover", this.PreventDefaultHandler);
        return true;
    }

    public UnregisterDropEvents = (element: HTMLElement): boolean => {
        const handler = this.dragElements.get(element);
        if (handler) {
            element.removeEventListener("drop", handler);
            element.removeEventListener("dragover", this.PreventDefaultHandler);
        }
        this.elementDataTransfers.delete(element);
        this.dragElements.delete(element);
        return true;
    }

    private GetFiles(element: HTMLElement): FileList {
        var files: FileList = null;
        if (element instanceof HTMLInputElement) {
            files = (element as HTMLInputElement).files;
        } else {
            const dataTransfer = this.elementDataTransfers.get(element);
            if (dataTransfer) {
                files = dataTransfer;
            }
        }
        return files;
    }

    public GetFileCount = (element: HTMLElement): number => {
        const files = this.GetFiles(element);
        if (!files) {
            return -1;
        }
        const result = files.length;
        return result;
    }

    public ClearValue = (element: HTMLInputElement): number => {
        if (element instanceof HTMLInputElement) {
            element.value = null;
        } else {
            this.elementDataTransfers.delete(element);
        }

        return 0;
    };

    public GetFileInfoFromElement = (element: HTMLElement, index: number, property: string): IFileInfo => {
        const files = this.GetFiles(element);
        if (!files) {
            return null;
        }

        const file = files.item(index);
        if (!file) {
            return null;
        }

        return this.GetFileInfoFromFile(file);
    }

    public Dispose = (fileRef: number): boolean => {
        return delete (this.fileStreams[fileRef]);
    }

    public GetFileInfoFromFile(file: File): IFileInfo {
        const result = {
            lastModified: file.lastModified,
            name: file.name,
            size: file.size,
            type: file.type
        };

        return result;
    }

    public OpenRead = (element: HTMLElement, fileIndex: number): number => {
        const files = this.GetFiles(element);
        if (!files) {
            throw 'No FileList available.';
        }
        const file = files.item(fileIndex);
        if (!file) {
            throw `No file with index ${fileIndex} available.`;
        }

        const fileRef: number = this.newFileStreamReference++;
        this.fileStreams[fileRef] = file;
        return fileRef;
    }

    public ReadFileUnmarshalledAsync = (readFileParams: IReadFileParams): Promise<number> => {
        return new Promise<number>((resolve, reject) => {
            if (!FileReaderComponent.getStreamBuffer) {
                FileReaderComponent.getStreamBuffer =
                        Blazor.platform.findMethod(this.assembly, this.namespace, this.className, "GetStreamBuffer");
            }
            
            const file: File = this.fileStreams[readFileParams.fileRef];
            try {
                const reader = new FileReader();
                reader.onload = ((r) => {
                    return () => {
                        try {
                            const contents: ArrayBuffer = <ArrayBuffer>r.result;
                            const dotNetBuffer = Blazor.platform.callMethod(FileReaderComponent.getStreamBuffer,
                                null,
                                [Blazor.platform.toDotNetString(readFileParams.callBackId.toString())]) as System_Array<any>;
                            const dotNetBufferView: Uint8Array = Blazor.platform.toUint8Array(dotNetBuffer);
                            dotNetBufferView.set(new Uint8Array(contents), readFileParams.bufferOffset);
                            resolve(contents.byteLength);
                        } catch (e) {
                            reject(e);
                        }
                    }
                })(reader);
                reader.readAsArrayBuffer(file.slice(readFileParams.position, readFileParams.position + readFileParams.count));
            } catch (e) {
                reject(e);
            }
        });
    }

    public ReadFileMarshalledAsync = (readFileParams: IReadFileParams): Promise<string> => {
        
        return new Promise<string>((resolve, reject) => {
            const file: File = this.fileStreams[readFileParams.fileRef];
            try {
                const reader = new FileReader();
                reader.onload = ((r) => {
                    return () => {
                        try {
                            const contents = r.result as string;
                            const data = contents ? contents.split(";base64,")[1] : null;
                            resolve(data);
                        } catch (e) {
                            reject(e);
                        }
                    }
                })(reader);
                reader.readAsDataURL(file.slice(readFileParams.position, readFileParams.position + readFileParams.count));
            } catch (e) {
                reject(e);
            }
        });
    }

    private PreventDefaultHandler = (ev: DragEvent) => {
        ev.preventDefault();
    }

    static ConcatFileList = class implements FileList {
        [index: number]: File;

        length: number;

        item(index: number): File {
            return this[index];
        }

        constructor(existing: FileList, additions: FileList) {
            for (let i = 0; i < existing.length; i++) {
                this[i] = existing[i];
            }

            var eligebleAdditions = [];

            // Check for doubles
            for (let i = 0; i < additions.length; i++) {
                let exists = false;
                let addition = additions[i];
                for (let j = 0; j < existing.length; j++) {
                    if (existing[j] === addition) {
                        exists = true;
                        break;
                    }
                }

                if (!exists) {
                    eligebleAdditions[eligebleAdditions.length] = addition;
                }
            }

            for (let i = 0; i < eligebleAdditions.length; i++) {
                this[i + existing.length] = eligebleAdditions[i];
            }

            this.length = existing.length + eligebleAdditions.length;
        }
    }
}

(window as any).FileReaderComponent = new FileReaderComponent();
