import * as encryptors from './encryptor.ts';
import type { VisualElement } from "./element.ts";
import type * as interfaces from './interfaces.ts';
import {ApplicationError, UserError} from "./exceptions.ts";

export class App extends EventTarget {
  private encryptors = [
    encryptors.RSAEncryptor,
    encryptors.AesGcmEncryptor,
  ]
  private encryptor: interfaces.Encryptor;
  private f?: File;
  
  private algoSelect: VisualElement<'select'>;
  private fileInput: VisualElement<'input'>;
  private keyInput: VisualElement<'input'>;
  private authInput: VisualElement<'input'>;
  
  private encryptButton: VisualElement<'button'>;
  private decryptButton: VisualElement<'button'>;
  private generateKeyButton: VisualElement<'button'>;
  private clearButton: VisualElement<'button'>;
  
  private rootElement: VisualElement<'div'>;
  
  constructor(
    algoSelect: VisualElement<'select'>,
    fileInput: VisualElement<'input'>,
    keyInput: VisualElement<'input'>,
    authInput: VisualElement<'input'>,
    encryptButton: VisualElement<'button'>,
    decryptButton: VisualElement<'button'>,
    generateKeyButton: VisualElement<'button'>,
    clearButton: VisualElement<'button'>,
    rootElement: VisualElement<'div'>,
  ) {
    super();
    
    this.algoSelect = algoSelect;
    this.fileInput = fileInput;
    this.keyInput = keyInput;
    this.authInput = authInput;
    this.encryptButton = encryptButton;
    this.decryptButton = decryptButton;
    this.generateKeyButton = generateKeyButton;
    this.clearButton = clearButton;
    this.rootElement = rootElement;
    
    this.fileInput.element.type = 'file';
    this.keyInput.element.type = 'file';
    
    this.encryptButton.element.disabled = true;
    this.decryptButton.element.disabled = true;
    this.authInput.element.disabled = true;
    
    this.encryptor = new this.encryptors[0];
    this.populateAlgorithms();
    
    this.encryptor.addEventListener('change', this.updateButtonsStates.bind(this));
    this.generateKeyButton.element.addEventListener('click', this.generateKey.bind(this));
    this.clearButton.element.addEventListener('click', this.clear.bind(this));
    this.keyInput.element.addEventListener('change', this.sourceKey.bind(this));
    this.fileInput.element.addEventListener('change', this.sourceFile.bind(this));
    this.encryptButton.element.addEventListener('click', this.encryptFile.bind(this));
    this.decryptButton.element.addEventListener('click', this.decryptFile.bind(this));
    this.algoSelect.element.addEventListener('change', this.selectAlgorithm.bind(this));
  }
  
  private populateAlgorithms() {
    for (let i = 0; i < this.encryptors.length; i++) {
      const algoOption = document.createElement('option');
      algoOption.value = String(i);
      algoOption.innerText = this.encryptors[i].algorithm;
      this.algoSelect.element.appendChild(algoOption);
    }
  }
  
  private selectAlgorithm() {
    this.clear();
    const algoIndex = Number(this.algoSelect.element.value);
    const encryptorClass = this.encryptors[algoIndex];
    this.authInput.element.disabled = encryptorClass.algorithm !== 'AES-GCM';
    this.encryptor = new encryptorClass;
  }
  
  private async encryptFile() {
    if (!this.encryptor.ready()) throw new ApplicationError('Encryptor is not initialized');
    if (!this.f) throw new UserError('No data uploaded');
    const fileBuff = await this.f.arrayBuffer();
    let authData = undefined;
    if (this.authInput.element.value) {
      const encoder = new TextEncoder();
      authData = encoder.encode(this.authInput.element.value).buffer as ArrayBuffer;
    }
    const encryptedBuff = await this.encryptor.encrypt(fileBuff, authData);
    const encryptedFile = new File([encryptedBuff], `${this.f.name}.encrypted`);
    this.downloadFile(encryptedFile);
  }
  
  private async decryptFile() {
    if (!this.encryptor.ready()) throw new ApplicationError('Encryptor is not initialized');
    if (!this.f) throw new UserError('No data uploaded');
    const fileBuff = await this.f.arrayBuffer();
    let authData = undefined;
    if (this.authInput.element.value) {
      const encoder = new TextEncoder();
      authData = encoder.encode(this.authInput.element.value).buffer as ArrayBuffer;
    }
    const encryptedBuff = await this.encryptor.decrypt(fileBuff, authData);
    const fileName = this.dropEncryptedFromName(this.f.name);
    const encryptedFile = new File([encryptedBuff], fileName);
    this.downloadFile(encryptedFile);
  }
  
  private dropEncryptedFromName(name: string): string {
    const pidx = name.lastIndexOf('.');
    const lastExt = name.substring(pidx + 1);
    if (lastExt === 'encrypted') return name.substring(0, pidx);
    return name;
  }
  
  private async generateKey() {
    const keys = await this.encryptor.generateJWK();
    keys.forEach( namedKey => {
      const keyStr = JSON.stringify(namedKey.key);
      if (!keyStr) throw new ApplicationError('Error exporting the key');
      const f = new File([keyStr], `${Date.now()}.${namedKey.name}.json`);
      this.downloadFile(f);
    });
  }
  
  private downloadFile(f: File) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(f);
    link.download = f.name;
    link.click();
  }
  
  private clear() {
    this.keyInput.element.value = '';
    this.fileInput.element.value = '';
    this.authInput.element.value = '';
    const changeEvent = new Event('change');
    this.keyInput.element.dispatchEvent(changeEvent);
    this.fileInput.element.dispatchEvent(changeEvent);
  }
  
  private sourceKey(e: Event) {
    const files: FileList | null = (e.target as HTMLInputElement).files;
    if (!files || !files.length) {
      this.encryptor.dropKeys();
    } else {
      const reader = new FileReader();
      reader.addEventListener('load', async (e) => {
        const jsonString = (e.target as FileReader).result;
        let jwk = {};
        try {
          jwk = JSON.parse(jsonString as string);
        } catch (e) {
          this.keyInput.element.value = '';
          this.keyInput.element.dispatchEvent(new Event('change'));
          throw new ApplicationError('Error reading a key file while parsing json file');
        }
        await this.encryptor.readJWK(jwk);
        // TODO: app change event. Update buttons,
        this.updateButtonsStates();
      });
      reader.addEventListener('error', () => {
        this.keyInput.element.value = '';
        this.keyInput.element.dispatchEvent(new Event('change'));
        // TODO: app change event. Update buttons,
        this.updateButtonsStates();
        throw new ApplicationError('Error reading a key file');
      });
      reader.readAsText(files[0]);
    }
  }
  
  private sourceFile(e: Event) {
    const files: FileList | null = (e.target as HTMLInputElement).files;
    if (!files) {
      this.f = undefined;
    } else {
      this.f = files[0];
    }
    this.updateButtonsStates();
  }
  
  private updateButtonsStates() {
    this.encryptButton.element.disabled = this.decryptButton.element.disabled = !(this.f && this.encryptor.ready());
  }
  
  public init() {
    document.body.appendChild(this.rootElement.element);
    this.rootElement.render();
  }
}