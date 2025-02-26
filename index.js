// src/tools/file-encryptor/dev/element.ts
class VisualElement {
  classList = [];
  children = [];
  element;
  text;
  constructor(elementType, classList, options) {
    this.element = document.createElement(elementType);
    this.classList = classList ?? [];
    if (options) {
      Object.assign(this.element, options);
    }
  }
  s(...args) {
    args.forEach((child) => {
      if (typeof child == "string") {
        if (args.length > 1) {
          throw new Error("single string or multimple children");
        }
        this.text = child;
        return;
      }
      this.children.push(child);
    });
    return this;
  }
  render() {
    this.element.classList.add(...this.classList);
    if (this.text) {
      this.element.innerHTML = this.text;
    } else {
      this.children.forEach((c) => {
        this.element.appendChild(c.render());
      });
    }
    return this.element;
  }
}

// src/tools/file-encryptor/dev/functions.ts
function structureElement(elementType, classList = [], options = {}) {
  return new VisualElement(elementType, classList, options);
}

// src/tools/file-encryptor/dev/exceptions.ts
class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserError";
  }
}

class ApplicationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ApplicationError";
  }
}

// src/tools/file-encryptor/dev/encryptor.ts
class AesGcmEncryptor extends EventTarget {
  static algorithm = "AES-GCM";
  keyLength = 256;
  key;
  iv;
  async encrypt(data, authData) {
    if (!this.ready())
      throw new Error("Encryptor is not initialized");
    return await window.crypto.subtle.encrypt({ name: AesGcmEncryptor.algorithm, iv: this.iv, additionalData: authData }, this.key, data);
  }
  async decrypt(data, authData) {
    if (!this.ready())
      throw new Error("Encryptor is not initialized");
    return await window.crypto.subtle.decrypt({ name: AesGcmEncryptor.algorithm, iv: this.iv, additionalData: authData }, this.key, data);
  }
  ready() {
    return !(!this.key || !this.iv);
  }
  async generateJWK() {
    const key = await window.crypto.subtle.generateKey({ name: AesGcmEncryptor.algorithm, length: this.keyLength }, true, ["encrypt", "decrypt"]);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const jwk = await window.crypto.subtle.exportKey("jwk", key);
    jwk.initv = this.base64iv(iv);
    return [{ name: "symmetric", key: jwk }];
  }
  async readJWK(jwk) {
    if (!jwk.initv)
      throw new TypeError("There is no valid initialization vector in key file");
    this.iv = this.ivFromB64(jwk.initv);
    this.key = await window.crypto.subtle.importKey("jwk", jwk, { name: AesGcmEncryptor.algorithm }, true, ["encrypt", "decrypt"]);
    this.dispatchEvent(new Event("change"));
  }
  base64iv(iv) {
    let bString = "";
    for (let i = 0;i < iv.length; i++) {
      bString += String.fromCharCode(iv[i]);
    }
    return window.btoa(bString);
  }
  ivFromB64(b64) {
    const bString = window.atob(b64);
    const iv = new Uint8Array(12);
    for (let i = 0;i < bString.length; i++) {
      iv[i] = bString.charCodeAt(i);
    }
    return iv;
  }
  dropKeys() {
    this.key = undefined;
    this.iv = undefined;
    this.dispatchEvent(new Event("change"));
  }
}

class RSAEncryptor extends EventTarget {
  static algorithm = "RSA-OAEP";
  rsaParams = {
    name: RSAEncryptor.algorithm,
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256"
  };
  key;
  async encrypt(data, authData) {
    if (authData)
      console.warn("Authentication data is omitted in RSA algorithm.");
    if (!this.ready())
      throw new Error("Encryptor is not initialized");
    return await window.crypto.subtle.encrypt({ name: RSAEncryptor.algorithm }, this.key, data);
  }
  async decrypt(data, authData) {
    if (!this.ready())
      throw new Error("Encryptor is not initialized");
    return await window.crypto.subtle.decrypt({ name: RSAEncryptor.algorithm }, this.key, data);
  }
  ready() {
    return !!this.key;
  }
  dropKeys() {
    this.key = undefined;
    this.dispatchEvent(new Event("change"));
  }
  async readJWK(jwk) {
    if (!jwk.key_ops || jwk.key_ops.length != 1 || !["encrypt", "decrypt"].includes(jwk.key_ops[0]))
      throw new UserError("Wrong key");
    this.key = await window.crypto.subtle.importKey("jwk", jwk, this.rsaParams, true, jwk.key_ops);
    this.dispatchEvent(new Event("change"));
  }
  async generateJWK() {
    const keyPair = await window.crypto.subtle.generateKey(this.rsaParams, true, ["encrypt", "decrypt"]);
    const publicKey = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const publicNamedKey = { name: "public", key: publicKey };
    const privateNamedKey = { name: "private", key: privateKey };
    return [publicNamedKey, privateNamedKey];
  }
}

// src/tools/file-encryptor/dev/app.ts
class App extends EventTarget {
  encryptors = [
    RSAEncryptor,
    AesGcmEncryptor
  ];
  encryptor;
  f;
  algoSelect;
  fileInput;
  keyInput;
  authInput;
  encryptButton;
  decryptButton;
  generateKeyButton;
  clearButton;
  rootElement;
  constructor(algoSelect, fileInput, keyInput, authInput, encryptButton, decryptButton, generateKeyButton, clearButton, rootElement) {
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
    this.fileInput.element.type = "file";
    this.keyInput.element.type = "file";
    this.encryptButton.element.disabled = true;
    this.decryptButton.element.disabled = true;
    this.authInput.element.disabled = true;
    this.encryptor = new this.encryptors[0];
    this.populateAlgorithms();
    this.encryptor.addEventListener("change", this.updateButtonsStates.bind(this));
    this.generateKeyButton.element.addEventListener("click", this.generateKey.bind(this));
    this.clearButton.element.addEventListener("click", this.clear.bind(this));
    this.keyInput.element.addEventListener("change", this.sourceKey.bind(this));
    this.fileInput.element.addEventListener("change", this.sourceFile.bind(this));
    this.encryptButton.element.addEventListener("click", this.encryptFile.bind(this));
    this.decryptButton.element.addEventListener("click", this.decryptFile.bind(this));
    this.algoSelect.element.addEventListener("change", this.selectAlgorithm.bind(this));
  }
  populateAlgorithms() {
    for (let i = 0;i < this.encryptors.length; i++) {
      const algoOption = document.createElement("option");
      algoOption.value = String(i);
      algoOption.innerText = this.encryptors[i].algorithm;
      this.algoSelect.element.appendChild(algoOption);
    }
  }
  selectAlgorithm() {
    this.clear();
    const algoIndex = Number(this.algoSelect.element.value);
    const encryptorClass = this.encryptors[algoIndex];
    this.authInput.element.disabled = encryptorClass.algorithm !== "AES-GCM";
    this.encryptor = new encryptorClass;
  }
  async encryptFile() {
    if (!this.encryptor.ready())
      throw new ApplicationError("Encryptor is not initialized");
    if (!this.f)
      throw new UserError("No data uploaded");
    const fileBuff = await this.f.arrayBuffer();
    let authData = undefined;
    if (this.authInput.element.value) {
      const encoder = new TextEncoder;
      authData = encoder.encode(this.authInput.element.value).buffer;
    }
    const encryptedBuff = await this.encryptor.encrypt(fileBuff, authData);
    const encryptedFile = new File([encryptedBuff], `${this.f.name}.encrypted`);
    this.downloadFile(encryptedFile);
  }
  async decryptFile() {
    if (!this.encryptor.ready())
      throw new ApplicationError("Encryptor is not initialized");
    if (!this.f)
      throw new UserError("No data uploaded");
    const fileBuff = await this.f.arrayBuffer();
    let authData = undefined;
    if (this.authInput.element.value) {
      const encoder = new TextEncoder;
      authData = encoder.encode(this.authInput.element.value).buffer;
    }
    const encryptedBuff = await this.encryptor.decrypt(fileBuff, authData);
    const fileName = this.dropEncryptedFromName(this.f.name);
    const encryptedFile = new File([encryptedBuff], fileName);
    this.downloadFile(encryptedFile);
  }
  dropEncryptedFromName(name) {
    const pidx = name.lastIndexOf(".");
    const lastExt = name.substring(pidx + 1);
    if (lastExt === "encrypted")
      return name.substring(0, pidx);
    return name;
  }
  async generateKey() {
    const keys = await this.encryptor.generateJWK();
    keys.forEach((namedKey) => {
      const keyStr = JSON.stringify(namedKey.key);
      if (!keyStr)
        throw new ApplicationError("Error exporting the key");
      const f = new File([keyStr], `${Date.now()}.${namedKey.name}.json`);
      this.downloadFile(f);
    });
  }
  downloadFile(f) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(f);
    link.download = f.name;
    link.click();
  }
  clear() {
    this.keyInput.element.value = "";
    this.fileInput.element.value = "";
    this.authInput.element.value = "";
    const changeEvent = new Event("change");
    this.keyInput.element.dispatchEvent(changeEvent);
    this.fileInput.element.dispatchEvent(changeEvent);
  }
  sourceKey(e) {
    const files = e.target.files;
    if (!files || !files.length) {
      this.encryptor.dropKeys();
    } else {
      const reader = new FileReader;
      reader.addEventListener("load", async (e2) => {
        const jsonString = e2.target.result;
        let jwk = {};
        try {
          jwk = JSON.parse(jsonString);
        } catch (e3) {
          this.keyInput.element.value = "";
          this.keyInput.element.dispatchEvent(new Event("change"));
          throw new ApplicationError("Error reading a key file while parsing json file");
        }
        await this.encryptor.readJWK(jwk);
        this.updateButtonsStates();
      });
      reader.addEventListener("error", () => {
        this.keyInput.element.value = "";
        this.keyInput.element.dispatchEvent(new Event("change"));
        this.updateButtonsStates();
        throw new ApplicationError("Error reading a key file");
      });
      reader.readAsText(files[0]);
    }
  }
  sourceFile(e) {
    const files = e.target.files;
    if (!files) {
      this.f = undefined;
    } else {
      this.f = files[0];
    }
    this.updateButtonsStates();
  }
  updateButtonsStates() {
    this.encryptButton.element.disabled = this.decryptButton.element.disabled = !(this.f && this.encryptor.ready());
  }
  init() {
    document.body.appendChild(this.rootElement.element);
    this.rootElement.render();
  }
}

// src/tools/file-encryptor/dev/index.ts
var root = new VisualElement("div", ["root"]);
var dropZone = new VisualElement("div", ["dropZone", "fx-c", "gap-10"]);
var encryptButton = new VisualElement("button");
var decryptButton = new VisualElement("button");
var generateKeyButton = new VisualElement("button");
var clearButton = new VisualElement("button");
var fileInput = new VisualElement("input", ["fx-2"], { id: "fileInput" });
var keyInput = new VisualElement("input", ["fx-2"], { id: "keyInput" });
var authInput = new VisualElement("input", ["fx-2"], { id: "authInput" });
var algoSelect = new VisualElement("select");
function main() {
  root.s(dropZone.s(algoSelect.s(), structureElement("div", ["fx-r"]).s(structureElement("label", ["w-30"], { for: "fileInput" }).s("File to encrypt"), fileInput.s()), structureElement("div", ["fx-r"]).s(structureElement("label", ["w-30"], { for: "keyInput" }).s("Encryption key"), keyInput.s()), structureElement("div", ["fx-r"]).s(structureElement("label", ["w-30"], { for: "vectorInput" }).s("Auth data"), authInput.s()), encryptButton.s("Encrypt"), decryptButton.s("Decrypt"), generateKeyButton.s("Generate encryption key"), clearButton.s("Clear")));
  const app = new App(algoSelect, fileInput, keyInput, authInput, encryptButton, decryptButton, generateKeyButton, clearButton, root);
  app.init();
}
window.onload = main;
