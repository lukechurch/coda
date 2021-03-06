class StorageManager {
    private static _MAX_ACTIVITY_STACK; // todo set limit and handle overruning activity stack
    private static _MAX_ACTIVITY_SAVE_FREQ = 3;
    private static _instance: StorageManager;
    lastEdit: Date;

    private constructor() { }

    static get instance() {
        return this._instance || (this._instance = new StorageManager());
    }

    isExpired(): boolean {
        // TODO
        // on every startup of CODA, check if storage is expired, i.e. more than 30 days have passed since last edit
        // if yes, clear storage

        var _MS_PER_DAY = 1000 * 60 * 60 * 24;

        // a and b are javascript Date objects
        function dateDiffInDays(a, b) {
            // Discard the time and time-zone information.
            let utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
            let utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

            return Math.floor((utc2 - utc1) / _MS_PER_DAY);
        }

        return (30 <= dateDiffInDays(this.lastEdit, new Date()));

    }

    getDataset(): Promise<string> {

        return new Promise(function (resolve, reject) {
            chrome.storage.local.get("dataset", (data) => {

                if (chrome.runtime.lastError) {
                    console.log("Runtime error: Chrome failed reading from storage!");
                    reject(chrome.runtime.lastError);
                }

                let dataset = data.hasOwnProperty("dataset") ? data["dataset"] : {};
                if (typeof dataset == "string") {
                    dataset = JSON.parse(dataset);
                }

                if (data == null || dataset == null || typeof data == 'undefined' ||
                    typeof dataset == 'undefined' || Object.keys(dataset).length == 0) {
                    reject(new Error("No valid dataset available in storage!"));

                }

                if (!dataset.hasOwnProperty("schemes") || !dataset.hasOwnProperty("sessions") ||
                    !dataset.hasOwnProperty("events") || Object.keys(dataset["events"]).length == 0) {
                    reject(new Error("Reading from storage failed - dataset format is corrupt."));
                }

                resolve(<string>dataset);
            });
        });
    }

    getActivity(): Promise<string> {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.get("instrumentation", data => {
                if (chrome.runtime.lastError) {
                    console.log("Runtime error: Chrome failed reading from storage!");
                    reject(chrome.runtime.lastError);
                }
                console.log(data);
                resolve(data["instrumentation"]);
            });

        });
    }

    clearActivityLog(): Promise<boolean> {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.remove("instrumentation", () => {
                if (chrome.runtime.lastError) {
                    console.log("Runtime error: Chrome failed reading from storage!");
                    reject(chrome.runtime.lastError);
                } else {
                    console.log("Cleared activity log!");
                    resolve(true);
                }
            });
        });
    }


    saveDataset(dataset: Dataset) {
        this.lastEdit = new Date();
        chrome.storage.local.set({
            "dataset": JSON.stringify(dataset),
            "lastEdit": JSON.stringify(this.lastEdit)
        }, () => {
            console.log("Stored dataset edit timestamp: " + this.lastEdit);
            chrome.storage.local.get((store) => {
                let data = JSON.parse(store["dataset"]);
                let datasetString = "dataset (schemes: "
                    + Object.keys(data["schemes"]).length +
                    ", events: " + Object.keys(data["events"]).length +
                    ", sessions: " + Object.keys(data["sessions"]).length + ")";

                console.log("In storage: Last edit (" + new Date(JSON.parse(store["lastEdit"])) + "), " + datasetString);
                chrome.storage.local.getBytesInUse((bytesUnUse: number) => {
                    console.log("Bytes in use: " + bytesUnUse);
                    console.log("QUOTA_BYTES: " + chrome.storage.local.QUOTA_BYTES);
                });
            });
        });
    }

    saveActivity(logEvent: { "category": string, "message": string, "messageDetails": Object, "data": any, "timestamp": Date }, uid?: string): void {
        // save user activity in storage for instrumentation
        if (logEvent.category.length != 0 && (logEvent.message.length > 0 || logEvent.data.length > 0) && logEvent.timestamp instanceof Date) {
            activity.push(logEvent);
            console.log("INSTRUMENTATION: " + logEvent.category + ":" + logEvent.message + ", stack size: " + activity.length);

            if (activity.length % StorageManager._MAX_ACTIVITY_SAVE_FREQ == 0) {
                chrome.storage.local.get("instrumentation", data => {
                    if (chrome.runtime.lastError) {
                        console.log(chrome.runtime.lastError);
                    } else {
                        let instr;
                        if (data["instrumentation"]) {
                            instr = JSON.parse(data["instrumentation"]).concat(activity);
                        }
                        else {
                            instr = activity;
                        }
                        chrome.storage.local.set({ "instrumentation": JSON.stringify(instr), }, () => {
                            if (chrome.runtime.lastError) {
                                console.log(chrome.runtime.lastError);
                            } else {
                                activity = [];
                                console.log("Saved activity log!");
                                chrome.storage.local.get((store) => {
                                    console.log("In storage: instrumentation stack size " + JSON.parse(store["instrumentation"]).length);
                                    chrome.storage.local.getBytesInUse((bytesUnUse: number) => {
                                        console.log("Bytes in use: " + bytesUnUse);
                                        console.log("QUOTA_BYTES: " + chrome.storage.local.QUOTA_BYTES);
                                    });
                                });
                            }
                        });
                    }
                });
            }
        }
    }

    clearStorage(): Promise<boolean> {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.remove(["dataset", "schemes"], () => {
                let error = chrome.runtime.lastError;
                if (error) {
                    console.error(error);
                    reject(new Error(error.message));
                } else {
                    resolve(true);
                }
            });

        });
    }

    saveUUID(id: String): Promise<string> {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.set({ 'userId': id }, () => {
                if (chrome.runtime.lastError) {
                    console.log(chrome.runtime.lastError);
                    reject(new Error('Failed to save uuid:' + id));
                }

                console.log("Saved user ID: " + id);
                resolve(String(id));
            });
        });
    }

    getUUID(): Promise<string> {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.get('userId', data => {
                if (chrome.runtime.lastError) {
                    console.log("Runtime error: Chrome failed reading from storage!");
                    reject(chrome.runtime.lastError);
                }

                let id: string = data.hasOwnProperty('userId') ? data['userId'] : null;

                if (id && id.length == 36) {
                    resolve(id);
                } else {
                    resolve("");
                }
            });
        });
    }
}
