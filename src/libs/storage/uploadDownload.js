// 'uploadDownload' storage provider - loading is just uploading a file, saving just initiates a file download
import { isValidStory, isOldVersion } from "@/stores/storyStore"

const INPUT_ELEMENT_ID = "__ULDL_STORAGE_INPUT"

const PICK_ERRORS = {
	cancelled: "Cancelled",
	tooManyFiles: "Too many files selected",
	noFiles: "No files selected",
}

const LOAD_ERRORS = {
	loadProblem: "There was a problem loading the file",
	oldVersion: "Project is in an old version and cannot be loaded",
	badFile: "The file does not contain project data",
	badJSON: "The file does not appear to be a valid format",
}

let ready = false
let inputElement

import { alert, prompt } from "@/libs/popups"

/**
 * Upload/Download Storage API
 *
 * @type       {Object}
 */
const ulDLStorage = {
	name: "Local Upload/Download Storage",
	get ready() {
		return ready
	},
	setup: async function setup() {
		inputElement = createInputElement()
		ready = true
		return true
	},
	load: async function load(filename) {
		const fname = filename.trim()
		let [story, err] = await loadFileContent(filename.fileObj)
		if (err) await alert(err)
		return err ? null : structuredClone(story)
	},
	save: async function save(filename, data) {
		if (filename && !filename.endsWith(".json")) filename += ".json"
		downloadJSON(data, filename)
		return filename
	},
	pick: async function pick() {
		inputElement = createInputElement()
		let [file, err] = await pickFile()
		err && console.log("Error picking file:", err)
		const fname = file ? new String(file.name) : null 
		if (fname) fname.fileObj = file
		return fname
	},
	chooseSaveFilename: async function chooseSaveFilename(suggestedFilename = "") {
		if (suggestedFilename && !suggestedFilename.endsWith(".json")) suggestedFilename += ".json"
		return await prompt("Enter a filename to save the data to:", suggestedFilename)
	},
}

/**
 * Creates an invisible input[file] element.
 *
 * @return     {HTMLInputElement}  { description_of_the_return_value }
 */
const createInputElement = () => {
	/** @type HTMLInputElement */
	let el = document.querySelector(`#${INPUT_ELEMENT_ID}`)
	if (!el) {
		el = document.createElement("input")
		el.type = "file"
		el.id = INPUT_ELEMENT_ID
		el.style.display = "none"
		document.body.appendChild(el)
	}
	return el
}

/**
 * Pick a file using the input[file] element
 *
 * @return     {Promise}  
 */
const pickFile = () => {
	return new Promise((resolve, reject) => {
		const i = inputElement
		const handlers = {
			change: e => {
				let res
				if ("files" in i && i.files.length) {
					res = i.files.length == 1 ? [i.files[0]] : [null, PICK_ERRORS.tooManyFiles]
				} else {
					res = [null, PICK_ERRORS.noFiles]
				}
				removeInputEventListeners(handlers)
				resolve(res)
			},
			cancel: () => {
				removeInputEventListeners(handlers)
				resolve([null, PICK_ERRORS.cancelled])
			},
		}
		addInputEventListeners(handlers)
		inputElement.click()
	})
}

/**
 * Adds input event listeners.
 *
 * @param      {Object}  listeners  The listeners
 */
const addInputEventListeners = listeners => {
	Object.entries(listeners).forEach(([type, handler]) => inputElement.addEventListener(type, handler))
}
/**
 * Removes input event listeners.
 *
 * @param      {Object}  listeners  The listeners
 */
const removeInputEventListeners = listeners => {
	Object.entries(listeners).forEach(([type, handler]) => inputElement.removeEventListener(type, handler))
}

/**
 * Loads story object from file.
 *
 * @param      {File}            file    The file
 * @return     {Promise<Array>}  resolving to array [storyObj|null, error desc if null story]
 */
const loadFileContent = async file => {
	let fileText, storyObject
	try {
		fileText = await readFileContent(file)
	} catch (error) {
		return [null, LOAD_ERRORS.loadProblem]
	}
	try {
		storyObject = JSON.parse(fileText)
	} catch (error) {
		return [null, LOAD_ERRORS.badJSON]
	}
	if (!isValidStory(storyObject)) return [null, LOAD_ERRORS.badFile]
	if (isOldVersion(storyObject.version)) return [null, LOAD_ERRORS.oldVersion]
	return [storyObject]
}

/**
 * Reads text content from a file.
 *
 * @param      {File}     file    The file
 * @return     {Promise}  resolving to file content
 */
function readFileContent(file) {
	const reader = new FileReader()
	return new Promise((resolve, reject) => {
		reader.onload = event => resolve(event.target.result)
		reader.onerror = error => reject(error)
		reader.readAsText(file)
	})
}

/**
 * Downloads a json object as given filename.
 *
 * @param      {Object}  obj       The object to stringify and download
 * @param      {String}  filename  The filename
 */
function downloadJSON(obj, filename) {
	const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj))
	const dlAnchor = document.createElement("a")
	dlAnchor.setAttribute("href", dataStr)
	dlAnchor.setAttribute("download", filename)
	dlAnchor.style.display = "none"
	document.body.appendChild(dlAnchor)
	dlAnchor.click()
	dlAnchor.remove()
}

export default ulDLStorage
