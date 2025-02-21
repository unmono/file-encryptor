import {AesGcmEncryptor} from './encryptor';
import {VisualElement} from './element';
import { structureElement} from "./functions";
import {App} from "./app.ts";

const root = new VisualElement(
  'div',
  ['root'],
);
const dropZone = new VisualElement(
  'div',
  ['dropZone', 'fx-c', 'gap-10']
);

const encryptButton = new VisualElement('button');
const decryptButton = new VisualElement('button');
const generateKeyButton = new VisualElement('button');
const clearButton = new VisualElement('button');


const fileInput = new VisualElement(
  'input',
  ['fx-2'],
  { id: 'fileInput', },
);

const keyInput = new VisualElement(
  'input',
  ['fx-2'],
  { id: 'keyInput', },
);

const authInput = new VisualElement(
  'input',
  ['fx-2', ],
  { id: 'vectorInput', },
);


function main() {
  root.s(
    dropZone.s(
      structureElement('div', ['fx-r']).s(
        structureElement('label', ['w-30'], { for: 'fileInput' }).s('File to encrypt'),
        fileInput.s(),
      ),
      structureElement('div', ['fx-r']).s(
        structureElement('label', ['w-30'], { for: 'keyInput' }).s('Encryption key'),
        keyInput.s(),
      ),
      structureElement('div', ['fx-r']).s(
        structureElement('label', ['w-30'], { for: 'vectorInput' }).s('Auth data'),
        authInput.s(),
      ),
      encryptButton.s('Encrypt'),
      decryptButton.s('Decrypt'),
      generateKeyButton.s('Generate encryption key'),
      clearButton.s('Clear'),
    ),
  );

  const app = new App(
    new AesGcmEncryptor(),
    fileInput,
    keyInput,
    authInput,
    encryptButton,
    decryptButton,
    generateKeyButton,
    clearButton,
    root,
  );
  app.init();
}

window.onload = main;