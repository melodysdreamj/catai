import wretch from "wretch";
import {downloadFileCLI} from './download/cli-download.js';
import objectAssignDeep from 'object-assign-deep';

const SEARCH_MODEL = "https://raw.githubusercontent.com/ido-pluto/catai/main/models.json";

export default class ModelURL {
    #setToExactDownloadLinks = false;

    constructor({model, tag, bind = "node-llama-cpp", key} = process.argv) {
        this.model = model;
        this.tag = tag;
        this.modelSettings = {
            bind,
            key,
            birthtime: new Date().toLocaleDateString()
        };
    }

    async #modelURLByName() {
        this.modelsDownloadLinks = await ModelURL.fetchModels();

        const modelName = this.model.toLocaleLowerCase();
        const foundModel = Object.keys(this.modelsDownloadLinks).find(x => x.toLocaleLowerCase() === modelName);

        return this.modelsDownloadLinks[foundModel];
    }

    async updateLink() {
        if (this.model.startsWith('http')) {
            this.downloadMap = {
                'model': this.model
            };
            this.model = this.model.split('/').pop();
            this.remoteExits = true;

        } else {
            const remoteModel = await this.#modelURLByName();
            if (!remoteModel) return;

            if (remoteModel.settings) {
                objectAssignDeep(this.modelSettings, remoteModel.settings);
            }

            this.remoteExits = true;

            if (remoteModel.download) {
                this.remoteModelDownload = remoteModel.download;
                this.downloadMap = this.#downloadLinkCreator(
                    remoteModel.download.branch
                );
            }
        }

        this.tag ??= this.model;
    }

    #downloadLinkCreator(branch = 'main') {
        return Object.fromEntries(
            Object.entries(this.remoteModelDownload.files).map(([tag, file]) => [tag, `${this.remoteModelDownload.repo}/resolve/${branch}/${file}`])
        );
    }

    useExactDownloadLinks() {
        if (this.remoteModelDownload) {
            this.downloadMap = this.#downloadLinkCreator(this.remoteModelDownload.commit);
            this.#setToExactDownloadLinks = true;
            return true;
        }
    }

    async createDownload(downloadFile) {
        try {
            for (const [local, remoteLink] of Object.entries(this.downloadMap)) {
                const saveFile = `${downloadFile}.${local}`;
                await downloadFileCLI(remoteLink, saveFile, `${this.tag.slice(0, 30)}:${local}`);
            }
        } catch (err) {
            console.error(err.message);

            if (!this.#setToExactDownloadLinks && this.useExactDownloadLinks()) {
                console.warn(`Link broken, trying to download again from alternative URLS`);
                return this.createDownload(downloadFile);
            }
        }

        this.modelSettings.downloadedFiles = Object.fromEntries(
            Object.entries(this.downloadMap).map(([local]) => [local, `${downloadFile}.${local}`])
        );
    }

    static async fetchModels() {
        const response = await wretch(SEARCH_MODEL).get().json();
        ModelURL.fetchModels = () => response;

        return response;
    }
}
