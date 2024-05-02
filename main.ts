import { App, Editor, MarkdownView, Modal, Notice, Plugin } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { SyntaxNode, SyntaxNodeRef } from '@lezer/common';
import { linter, lintGutter, Diagnostic } from '@codemirror/lint';
import { it } from 'node:test';


const util = require('util');
const exec = util.promisify(require('child_process').exec);
var child_process = require('child_process');

export default class MyPlugin extends Plugin {

	async onload() {
		this.getExtension()


		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: () => {
				this.getCodeBlocks()
			}
		});
	}

	isNode(node: SyntaxNode | undefined): node is SyntaxNode {
		return (node as SyntaxNode) !== undefined
	}


	applyFormat(content: string): Promise<string> {
		const root = '/opt/homebrew/bin/swiftformat'
		const args = [
			'stdin',
			'--quiet',
			'--swiftversion',
			'5.10',
			'--emptybraces',
			'linebreak',
			'--wrapcollections',
			'before-first',
			'--wraparguments',
			'before-first',
		];
		const options = {
			'input': content
		}
		var sfmt = child_process.spawn(root, args, options);

		// Although .exec() is buffered for us,
		// we'd have to escape everything we pass in. Boo.
		var buffer: any[] = []

		sfmt.stdin.write(content);
		sfmt.stdin.end();

		sfmt.stderr.on('data', (chunk: any) => {
			new ErrorModal(this.app, `${chunk}`).open()
		})

		sfmt.stdout.on('data', (chunk: any) => {
			buffer.push(chunk)
		});

		return new Promise((resolve, reject) => {
			sfmt.on('close', (code: any) => {
				console.log(`closed stream with code ${code}`)
				resolve(`${buffer.join('')}`)
			})
		})
	}

	async getCodeBlocks() {

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view === null) {
			return "null view"
		}
		const editorView: EditorView = (view.editor as any).cm as EditorView;
		let cursor = syntaxTree(editorView.state).cursor()

		var startNodePos: number = 0
		var endNodePos: number = 0

		cursor.iterate((node: SyntaxNodeRef) => {
			// Find code blocks with the lang
			if (node.name.contains("HyperMD-codeblock-begin")) {
				startNodePos = node.node.from
				return false
			} else if (node.type.name.contains("HyperMD-codeblock-end")) {
				endNodePos = node.node.to
				return false
			}
		})

		if (startNodePos === 0 && endNodePos === 0) {
			console.log("yikes no nodes")
			return
		}

		startNodePos += 3
		endNodePos -= 3

		let codeBlockContent = editorView.state.sliceDoc(startNodePos, endNodePos)
		let formatted = await this.applyFormat(codeBlockContent)

		editorView.dispatch({
			changes: {
				from: startNodePos,
				to: endNodePos,
				insert: formatted
			}
		})

		console.log(`start: ${startNodePos}`)
		console.log(`end: ${endNodePos}`)

		// console.log(startNode)
		// return editor.getSelection()

	}

	getExtension() {

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);


		this.getCodeBlocks()

		if (view === null) {
			return "null view"
		}

		// const editorView: EditorView = (view.editor as any).cm as EditorView;


		// this.registerEditorExtension(
		// 	linter((editorView: EditorView) => {

		// 		let diagnostics: Diagnostic[] = []
		// 		let cursor = syntaxTree(editorView.state).cursor()
		// 		cursor.iterate((node: any) => {

		// 			// Find code blocks with the lang
		// 			if (node.name.contains("HyperMD-codeblock-begin")) {
		// 				console.log(node)
		// 				diagnostics.push({
		// 					from: cursor.from,
		// 					to: cursor.to,
		// 					severity: "warning",
		// 					message: `${node}`,
		// 					actions: []
		// 				})
		// 			} else if (node.name.contains("HyperMD-codeblock-end")) {
		// 				console.log(node)
		// 				diagnostics.push({
		// 					from: cursor.from,
		// 					to: cursor.to,
		// 					severity: "warning",
		// 					message: `${node}`,
		// 					actions: []
		// 				})
		// 			}
		// 		})

		// 		return diagnostics
		// 	}))

		this.registerEditorExtension(lintGutter())
	}


	onunload() {

	}
}

class ErrorModal extends Modal {
	constructor(app: App, message: string) {
		super(app);
		const { contentEl } = this;
		contentEl.setText(message);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
