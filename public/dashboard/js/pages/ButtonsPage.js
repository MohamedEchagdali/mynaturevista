// ===== pages/ButtonsPage.js =====
import { ButtonEditorManager } from '../components/ButtonEditorManager.js';

export class ButtonsPage {
  constructor() {
    this.editorManagers = [];
  }

  async init() {
    this.setupButtonEditors();
  }

  setupButtonEditors() {
    document.querySelectorAll('.editor-container').forEach(container => {
      const editorManager = new ButtonEditorManager(container);
      editorManager.init();
      this.editorManagers.push(editorManager);
    });
  }
}
