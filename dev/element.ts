import type * as interfaces from './interfaces';

interface ElementOptions {
  elementType: string;
  classList: string[];
  text?: string;
}

export class VisualElement<Tag extends keyof HTMLElementTagNameMap> {
  public classList: Array<string> = [];
  public children: Array<interfaces.VisualElement> = [];
  public element: HTMLElementTagNameMap[Tag];
  public text?: string;

  constructor(elementType: Tag, classList?: string[], options?: any) {
    this.element = document.createElement(elementType) as HTMLElementTagNameMap[Tag];
    this.classList = classList ?? [];
    if (options) {
      Object.assign(this.element, options);
    }
  }

  public s(...args: Array<interfaces.VisualElement> | string[]): VisualElement<Tag> {
    args.forEach( child => {
      if (typeof child == 'string') {
        if (args.length > 1) {
          // TODO
          throw new Error('single string or multimple children');
        }
        this.text = child;
          return;
      }
      this.children.push(child);
    });
    return this;
  }

  public render(): HTMLElementTagNameMap[Tag] {
    this.element.classList.add(...this.classList);
      if (this.text) {
        this.element.innerHTML = this.text;
      } else {
        this.children.forEach( (c: interfaces.VisualElement) => {
          this.element.appendChild(c.render());
        });
      }
    return this.element;
  }
}