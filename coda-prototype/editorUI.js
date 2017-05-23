/*
Copyright (c) 2017 Coda authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/*

EDITORUI.JS
Responsible for drawing and initialising the code editor
Handles events related to, and happening within, the editor:

- adding a new scheme (with the UI changes handled by tableUI as it's a part of table UI)
- scheme name
- adding and deleting codes
- assigning shortcuts
- assigning colors
- assigning words
- initiates uploading new coding schemes
- initiates exporting the current coding scheme
- deleting the coding scheme (with the UI changes handled by tableUI as it's a part of table UI)

 */

var codeEditorManager =  {

    editorContainer: {},
    editorPanel: {},
    codeTable: {},
    addCodeButton: {},
    closeEditorButton: {},
    cancelEditorButton: {},
    addSchemeButton: {},
    saveSchemeButton: {},

    init: function(editorContainer) {

        $(editorContainer).hide();
        editorOpen = false;

        this.editorContainer = editorContainer;
        this.editorPanel = this.editorContainer.find(".panel");
        this.codeTable = this.editorPanel.find("tbody");
        this.addCodeButton = this.editorPanel.find("#add-code");
        this.closeEditorButton = this.editorPanel.find("#close-editor");
        this.cancelEditorButton = this.editorPanel.find("#cancel-button");
        this.addSchemeButton = $("#add-scheme");
        this.saveSchemeButton = this.editorPanel.find("#scheme-save-button");
        this.bindAddCodeButtonListener(this.codeTable);
        this.bindCloseDialogListeners();
        this.bindAddSchemeListeners();
        this.bindNameInputListeners();

        var logColorChange = debounce((code, color) => {
            if (code) {
                console.log(new Date() + " color");
                // update the activity stack
                storage.saveActivity({
                    "category": "SCHEME",
                    "message": "Changed color for code in scheme",
                    "messageDetails": {"scheme": code.owner.id, "code": code.id, "color": color.toHex()},
                    "data": tempScheme.toJSON(),
                    "timestamp": new Date()
                });
            }
        }, 1000, false);

        $('#color-pick').colorpicker({component: $("#colorpicker-trigger")});
        $('#color-pick').on("changeColor", function(event) {

            if (!$.isEmptyObject(state.activeEditorRow)) {
                $(state.activeEditorRow).css("background-color", event.color.toHex());
                var code = tempScheme.codes.get($(state.activeEditorRow).attr("codeid"));
                if (code) {
                    code.color = event.color.toHex();
                }
            }

            $("#word-textarea").find(".tag").css({"background-color": event.color.toHex()});
            logColorChange(code, event.color); // will only run every N ms in order not to flood the activity log
        });

        $("#delete-scheme-button").on("click", () => {
           let nextActiveSchemeId = codeEditorManager.deleteScheme(tempScheme.id + "");
           activeSchemeId = nextActiveSchemeId;
           codeEditorManager.editorContainer.hide();
           codeEditorManager.editorContainer.find("tbody").empty();
           codeEditorManager.bindAddCodeButtonListener();
           codeEditorManager.editorContainer.find("#scheme-name-input").val("");
           editorOpen = false;

           // update the activity stack
           storage.saveActivity({
               "category": "SCHEME",
               "message": "Deleted scheme",
               "messageDetails": {"scheme": tempScheme["id"]},
               "data": tempScheme.toJSON(),
               "timestamp": new Date()
           });
           tempScheme = {};
        });
    },

    bindNameInputListeners: function() {

        var nameInput = $("#scheme-name-input");

        nameInput.on("keydown", function(event) {

            if (event.keyCode === 13) {
                $(this).attr("value", $(this).val());
                tempScheme.name = $(this).attr("value");
                $(this).blur();
            }

            event.stopPropagation();

        });

    },

    bindAddSchemeListeners: function() {
        var editorContainer = this.editorContainer;
        var addSchemeButton = this.addSchemeButton;
        var saveSchemeButton = this.saveSchemeButton;
        var headerDecoColumn = $("#header-decoration-column");


        addSchemeButton.on("click", function() {

            // TODO: cleverly assign scheme ids
            var newId = UIUtils.randomId(Object.keys(newDataset.schemes));
            tempScheme = new CodeScheme(newId, "", true);
            $("#color-pick").colorpicker('setValue', "#ffffff");

            saveSchemeButton.off("click");
            saveSchemeButton.on("click", function() {

                tempScheme["name"] = editorContainer.find("#scheme-name-input").val();
                tempScheme.codes.forEach(function(codeObj) {
                    var row = editorContainer.find("tr[id='" + codeObj["id"] + "']");

                    if (row.length > 0) {
                        var value = row.find(".code-input").val();
                        var shortcut = row.find(".shortcut-input").val();

                        if (value.length > 0) {
                            codeObj.value = value;
                        }

                        if (shortcut.length > 0) {
                            codeObj.shortcut = UIUtils.ascii(shortcut);
                        }
                    }
                });

                // todo prevent saving when there is an empty code


                let validation = CodeScheme.validateScheme(tempScheme);
                var hasError = false;

                if (!validation.name) {
                    // turn on error on scheme name field
                    let schemeNameCol = $("#scheme-name-col");
                    schemeNameCol.addClass("has-error");
                    schemeNameCol.find(".input-group")
                        .addClass("has-feedback")
                        .addClass("has-error");
                    hasError = true;
                    console.log("Error: Invalid input values given for scheme.");

                } else {
                    let schemeNameCol = $("#scheme-name-col");
                    schemeNameCol.removeClass("has-error");
                    schemeNameCol.find(".input-group")
                        .removeClass("has-feedback")
                        .removeClass("has-error");
                }

                // turn on error on the right shortcut field(s)
                $("#code-table").find(".code-row").each((index, codeRow) => {
                    let codeId = $(codeRow).attr("codeid");
                    if (validation.invalidShortcuts.indexOf(codeId) > -1) {
                        $(codeRow).find(".feedback-input-field.shortcut")
                            .addClass("has-error")
                            .addClass("has-feedback");

                        hasError = true;
                        console.log("Error: Invalid shortcut input values given for scheme.");

                    } else {
                        $(codeRow).find(".feedback-input-field.shortcut")
                            .removeClass("hass-error")
                            .removeClass("has-feedback");
                    }
                });

                // turn on error on the right code value field(s)
                $("#code-table").find(".code-row").each((index, codeRow) => {
                    let codeId = $(codeRow).attr("codeid");
                    if (validation.invalidValues.indexOf(codeId) > -1) {
                        $(codeRow).find(".feedback-input-field.code")
                            .addClass("has-error")
                            .addClass("has-feedback");

                        hasError = true;
                        console.log("Error: Invalid code name input values given for scheme.");

                    } else {
                        $(codeRow).find(".feedback-input-field.code")
                            .removeClass("has-error")
                            .removeClass("has-feedback");
                    }
                });

                if (hasError) {
                    return;
                }

                // remove error message for scheme name
                let schemeNameCol = $("#scheme-name-col");
                schemeNameCol.removeClass("has-error");
                schemeNameCol.find(".input-group")
                    .removeClass("has-feedback")
                    .removeClass("has-error");

                newDataset.schemes[newId] = tempScheme;
                messageViewerManager.codeSchemeOrder.push(newId + "");

                messageViewerManager.addNewSchemeColumn(tempScheme, name);

                var header = headerDecoColumn.find("[scheme='" + tempScheme["id"] + "']");
                header.children("i").text(tempScheme["name"]);

                undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);

                editorContainer.hide();
                editorContainer.find("tbody").empty();
                codeEditorManager.bindAddCodeButtonListener();
                editorContainer.find("#scheme-name-input").val("");
                scrollbarManager.redraw(newDataset, newId);
                scrollbarManager.redrawThumb(0);
                $(scrollbarManager.scrollbarEl).drawLayers();
                editorOpen = false;
                tempScheme = {};
            });

            $(editorContainer).show();
            editorOpen = true;
            $("#scheme-name-input").focus();
        });

    },


    bindSaveEditListener: function() {
        var editorContainer = this.editorContainer;
        var saveSchemeButton = this.saveSchemeButton;
        var headerDecoColumn = $("#header-decoration-column");

        saveSchemeButton.off("click");
        saveSchemeButton.on("click", function () {

            tempScheme.codes.forEach(function(codeObj) {
                var row = editorContainer.find("tr[codeid='" + codeObj["id"] + "']");

                if (row.length > 0) {
                    //todo codeobject should just have all this saved already
                    let value = row.find(".code-input").val();
                    let shortcut = row.find(".shortcut-input").val();

                    if (value.length > 0) {
                        codeObj.value = value;
                    }

                    if (shortcut.length > 0) {
                        codeObj.shortcut = UIUtils.ascii(shortcut);
                    }
                }
            });

            tempScheme["name"] = editorContainer.find("#scheme-name-input").val(); //todo codeobject should just have all this saved already

            /*
            Validate entered values
             */
            let validation = CodeScheme.validateScheme(tempScheme);
            var hasError = false;
            if (!validation.name) {
                // turn on error on scheme name field
                let schemeNameCol = $("#scheme-name-col");
                schemeNameCol.addClass("has-error");
                schemeNameCol.find(".input-group")
                    .addClass("has-feedback")
                    .addClass("has-error");
                hasError = true;
            } else {
                let schemeNameCol = $("#scheme-name-col");
                schemeNameCol.removeClass("has-error");
                schemeNameCol.find(".input-group")
                    .removeClass("has-feedback")
                    .removeClass("has-error");
            }

            // turn on error on the right shortcut field(s)
            $("#code-table").find(".code-row").each((index, codeRow) => {
                let codeId = $(codeRow).attr("codeid");
                if (validation.invalidShortcuts.indexOf(codeId) > -1) {
                    $(codeRow).find(".feedback-input-field.shortcut")
                        .addClass("has-error")
                        .addClass("has-feedback");
                    hasError = true;

                } else {
                    $(codeRow).find(".feedback-input-field.shortcut")
                        .removeClass("hass-error")
                        .removeClass("has-feedback");
                }
            });


            // turn on error on the right code value field(s)
            $("#code-table").find(".code-row").each((index, codeRow) => {
                let codeId = $(codeRow).attr("codeid");
                if (validation.invalidValues.indexOf(codeId) > -1) {
                    $(codeRow).find(".feedback-input-field.code")
                        .addClass("has-error")
                        .addClass("has-feedback");
                    hasError = true;
                } else {
                    $(codeRow).find(".feedback-input-field.code")
                        .removeClass("has-error")
                        .removeClass("has-feedback");
                }
            });


            if (hasError) {
                return;
            }

            // if no error, remove the error message around scheme name
            let schemeNameCol = $("#scheme-name-col");
            schemeNameCol.removeClass("has-error");
            schemeNameCol.find(".input-group")
                .removeClass("has-feedback")
                .removeClass("has-error");

            // update header in message view
            var header = headerDecoColumn.find("[scheme='" + tempScheme["id"] + "']");
            header.find("i.scheme-name").text(tempScheme["name"]);

            // update the original scheme
            newDataset.schemes[tempScheme["id"]].copyCodesFrom(tempScheme);

            // code and re-sort dataset
            regexMatcher.codeDataset(tempScheme["id"]);
            //newDataset.events = messageViewerManager.currentSort(newDataset.events, tempScheme, true);
            if (messageViewerManager.currentSort == messageViewerManager.sortUtils.sortEventsByConfidenceOnly) {
                newDataset.sortEventsByConfidenceOnly(tempScheme["id"]);
            }
            if (messageViewerManager.currentSort == messageViewerManager.sortUtils.sortEventsByScheme) {
                newDataset.sortEventsByScheme(tempScheme["id"], true);
            }
            if (messageViewerManager.currentSort == messageViewerManager.sortUtils.restoreDefaultSort) {
                newDataset.restoreDefaultSort();
            }


            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Saved scheme",
                "messageDetails": {"scheme": tempScheme["id"]},
                "data": newDataset.schemes[tempScheme["id"]].toJSON(),
                "timestamp": new Date()
            });

            // redraw rows
            var tbody = "";

            let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
            for (let i = (messageViewerManager.lastLoadedPageIndex - 1) * halfPage; i < messageViewerManager.lastLoadedPageIndex * halfPage + halfPage; i++) {
                let eventKey = newDataset.eventOrder[i];
                tbody += messageViewerManager.buildRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner);
            }

            // redraw scrollbar
            const thumbPosition = scrollbarManager.getThumbPosition();
            scrollbarManager.redraw(newDataset, tempScheme["id"]);
            scrollbarManager.redrawThumb(thumbPosition);

            var messagesTbody = messageViewerManager.messageContainer.find("tbody");
            var previousScrollTop = messageViewerManager.messageContainer.scrollTop();
            var previousActiveRow = activeRow.attr("id");

            messagesTbody.empty();
            messagesTbody.append(tbody);
            messageViewerManager.messageContainer.scrollTop(previousScrollTop);
            activeRow = $("#" + previousActiveRow).addClass("active");

            header.find("i.scheme-name").trigger("click"); // will make it active column

            undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);

            editorContainer.hide();
            editorContainer.find("tbody").empty();
            codeEditorManager.bindAddCodeButtonListener();
            editorContainer.find("#scheme-name-input").val("");
            editorOpen = false;

        });
    },


    bindCloseDialogListeners: function() {
        var editorContainer = this.editorContainer;
        var closeButton = this.closeEditorButton;
        var cancelButton = this.cancelEditorButton;

        closeButton.on("click", function() {
            editorContainer.hide();
            editorContainer.find("tbody").empty();
            codeEditorManager.bindAddCodeButtonListener();
            $("#scheme-name-input").attr("value", "").val("");

            // clear potential error message for scheme name (rows will be deleted anyway)
            let schemeNameCol = $("#scheme-name-col");
            schemeNameCol.removeClass("has-error");
            schemeNameCol.find(".input-group")
                .removeClass("has-feedback")
                .removeClass("has-error");

            editorOpen = false;
            state.activeEditorRow = {};

            // update the activity stack
            storage.saveActivity({
                "category" : "SCHEME",
                "message": "Closed editor for scheme",
                "messageDetails": {"scheme": tempScheme["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()
            });
        });

        cancelButton.on("click", function() {
            editorContainer.hide();
            editorContainer.find("tbody").empty();
            codeEditorManager.bindAddCodeButtonListener();
            $("#scheme-name-input").attr("value", "").val("");

            // clear potential error message for scheme name (rows will be deleted anyway)
            let schemeNameCol = $("#scheme-name-col");
            schemeNameCol.removeClass("has-error");
            schemeNameCol.find(".input-group")
                .removeClass("has-feedback")
                .removeClass("has-error");

            editorOpen = false;
            state.activeEditorRow = {};

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Cancel edits to scheme",
                "messageDetails": {"scheme": tempScheme["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()
            });
        });
    },

    bindAddCodeButtonListener: function() {

        var addCodeInputRow = codeEditorManager.addCodeInputRow;

        this.editorContainer.find("tbody").append('<tr class="row add-code-row">' +
            '<td class="col-md-6">' +
            '<button id="add-code" class="btn btn-default">' +
            '<i class="glyphicon glyphicon-plus">' +
            '</i>' +
            '</button>' +
            '</td>' +
            '<td class="col-md-5"></td>' +
            '<td class="col-md-1"></td>' +
            '</tr>');

        $(".add-code-row").on("click", function() {
            let newCode = addCodeInputRow("","", "#ffffff", "", []); // todo will return codeObject
            codeEditorManager.updateCodePanel(newCode);

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Added new code to scheme",
                "messageDetails": {"scheme": tempScheme["id"], "code": newCode.id},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()});
        });
    },

    addCodeInputRow: function(code, shortcut, color, id, words) {

        var bindInputListeners = codeEditorManager.bindInputListeners;
        var codeObject;
        if (!color ||color == undefined) color = "#ffffff";

        var newId = id;
        if (id.length === 0) {
            newId = tempScheme["id"] + "-" + UIUtils.randomId(); // todo: check for duplicates
            codeObject = new Code(tempScheme, newId, code, color, shortcut, false);
            tempScheme.codes.set(newId, codeObject); // todo: fix owner when saving to parent scheme - what does this mean
        }

        $(".code-row").each(function(i,row) {$(row).removeClass("active")});

        var row = $("<tr class='row active code-row' codeid='" + newId + "'></tr>").insertBefore($(".add-code-row"));
        state.activeEditorRow = row;

        var codeCell = $("<td class='col-md-6' style='background-color:" + color + "'></td>").appendTo(row);
        var shortcutCell = $("<td class='col-md-5' style='background-color:" + color + "'></td>").appendTo(row);
        var buttonCell = $("<td class='col-md-1' style='background-color:" + color + "'></td>").appendTo(row);


        var codeInputWithFeedback =
            $("<div class='feedback-input-field code'>" +
            "<i class='glyphicon glyphicon-exclamation-sign'></i>" +
            "<input type='text' class='form-control code-input' placeholder='enter code...' value='" + code + "'/>" +
            "<small class='help-block' result='INVALID'>Invalid code name format<sup data-toggle='tooltip' data-placement='top'" +
                "data-container='body' data-original-title='Valid characters: a-zA-Z0-9 and -/ or whitespace in between, max length 50'>?</sup></small>" +
            "</div>")
                .appendTo(codeCell);

        codeInputWithFeedback.find("sup").tooltip();
        codeInputWithFeedback.find("input").focus();

        shortcut = ("" + shortcut).length > 0 ? String.fromCharCode(shortcut) : "";

        var shortcutInputWithFeedback =
            $("<div class='feedback-input-field shortcut'>" +
                "<i class='glyphicon glyphicon-exclamation-sign'></i>" +
                "<input type='text' class='form-control shortcut-input' placeholder='type shortcut key...' maxlength='1' value='" + shortcut + "'/>" +
                "<small class='help-block' result='INVALID'>Invalid shortcut character<sup data-toggle='tooltip' data-placement='top'" +
                "data-container='body' data-original-title='Valid characters: a-zA-Z0-9'>?</sup></small>" +
                "</div>")
                .appendTo(shortcutCell);

        shortcutInputWithFeedback.find("sup").tooltip();

        var button = $("<button type='button' class='btn btn-danger delete-code'>" +
            "<i class='glyphicon glyphicon-remove'></i>" +
            "</button>").appendTo(buttonCell);

        [codeCell, shortcutCell, buttonCell].forEach(function(td) {
           $(td).css({"background-color": color});
        });

        row.on("click", function() {
            state.activeEditorRow.removeClass("active");
            state.activeEditorRow = $(this);
            state.activeEditorRow.addClass("active");

            var code = tempScheme.codes.get($(this).attr("codeid"));

            if (code) {
                codeEditorManager.updateCodePanel(code);
            }
        });

        bindInputListeners(row);

        return codeObject;
    },


    updateCodePanel: function(codeObj) {

        // todo problem when new row is added - codeObj doesn't exist yet, so can't bind the event handler for tags
        // assume called with valid codeObject

        var color = codeObj ? (codeObj["color"].length > 0 ? codeObj["color"] : "#ffffff") : "#ffffff";
        let words = codeObj ? (codeObj["words"].length > 0 ? codeObj["words"].slice(0) : []) : [];
        let colorPicker = $("#color-pick");
        var wordTextarea = $("#word-textarea");
        var regexField = $("#regex-edit").find("input");
        colorPicker.find("input").attr("value", color);
        colorPicker.colorpicker('setValue', color);

        if (color === "#ffffff") color = "#9e9e9e"; // set the tags to a darker grey color
        let selectObj= wordTextarea.find("select");
        selectObj.tagsinput('removeAll');

        $(selectObj).off('itemAdded');
        $(selectObj).off('itemRemoved');

        for (let word of words) {
            selectObj.tagsinput('add', word);
        }

        $("span.tag").css({'background-color': color});

        $(selectObj).on('itemAdded', function(event) {
            // event.item: contains the item
            // event.cancel: set to true to prevent the item getting added
            let color = (codeObj["color"] === "#ffffff" ? "#9e9e9e" : codeObj["color"]);
            wordTextarea.find(".tag").css({'background-color': color});
            codeObj.addWords(event.item);
            regexField.val(regexMatcher.generateOrRegex(codeObj["words"]));
            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Added word to code in scheme",
                "messageDetails": {"word": event.item, "scheme": tempScheme["id"], "code": codeObj["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()});
        });

        $(selectObj).on('itemRemoved', function(event) {
            // event.item: contains the item
            codeObj.deleteWords([event.item]);
            regexField.val(regexMatcher.generateOrRegex(codeObj["words"]));
            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Deleted word from code in scheme",
                "messageDetails": {"word": event.item, "scheme": tempScheme["id"], "code": codeObj["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()});
        });

        regexField.val(regexMatcher.generateOrRegex(codeObj["words"]));
    },


    bindInputListeners: function(inputRow) {

        var inputRow = $(inputRow);
        var codeInput = inputRow.find(".code-input");
        var shortcutInput = inputRow.find(".shortcut-input");
        var deleteButton = inputRow.find(".delete-code");

        codeInput.on("keydown", function(event){
            if (event.keyCode === 13) {
                // save and move to shortcut field

                var codeId = $(this).parents("tr").attr("codeid");
                var codeObj = tempScheme.codes.get(codeId);

                if (codeObj) {
                    codeObj["value"] = ($(this).val());
                }

                $(this).attr("value", $(this).val());
                $(this).parents("tr").find(".shortcut-input").focus();

            }
        });

        shortcutInput.on("keydown", function(event){
            if (event.keyCode === 13) {
                $(this).attr("value", $(this).val());

                var nextRow = $(this).parents("tr").next();

                if (nextRow.length > 0 && nextRow.attr("class") !== "row add-code-row") {
                    nextRow.find(".code-input").focus();

                } else {
                    //codeEditorManager.addCodeInputRow("", "", "#ffffff", parseInt($("tbody > .code-row:last").attr("id")) + 1);

                    nextRow = $(this).parents("tr").next();
                    nextRow.find(".code-input").focus();
                }
            }
        });

        codeInput.on("focusout", function(){

            var codeId = $(this).parents("tr").attr("codeid");
            var codeObj = tempScheme.codes.get(codeId);

            if (codeObj) {
                codeObj["value"] = ($(this).val());
            }
        });

        shortcutInput.on("focusout", function(){

            var codeId = $(this).parents("tr").attr("codeid");
            var codeObj = tempScheme.codes.get(codeId);

            if (codeObj) {
                let ascii = UIUtils.ascii($(this).val());

                if ($(this).val().length === 0 || isNaN(ascii) ) {
                    codeObj["shortcut"] = "";
                } else {
                    codeObj["shortcut"] = ascii;
                }
            }

        });

        deleteButton.on("click", function() {

            // TODO: unbind shortcuts
            // TODO: remove code from dropdowns
            // TODO: stop relying on Map keys as indices...
            let id = $(this).parents("tr").attr("codeid");
            let next = $(inputRow).next(".code-row");
            let prev = $(inputRow).prev(".code-row");
            $(inputRow).remove();
            tempScheme.codes.delete(id);

            if (next.length != 0) {
                $(next).addClass("active");
                state.activeEditorRow = $(next);
                codeEditorManager.updateCodePanel(tempScheme.codes.get($(next).attr("codeid")));

            } else if (prev.length != 0){
                $(prev).addClass("active");
                state.activeEditorRow = $(prev);
                codeEditorManager.updateCodePanel(tempScheme.codes.get($(prev).attr("codeid")));

            } else {
                // todo important - what happens when all codes are deleted from list
            }

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Deleted code from scheme",
                "messageDetails": {"code": id ,"scheme": tempScheme["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()
            });

        });
    },

    deleteScheme: function(schemeId) {
        let schemeSnapshot = newDataset.schemes[schemeId];
        let nextSchemeId;

        // delegate uglifying to datastructure
        newDataset.deleteScheme(schemeId);
        delete schemes[schemeId];

        let schemeOrderIndex = messageViewerManager.codeSchemeOrder.indexOf(schemeId);
        if (schemeOrderIndex > -1) messageViewerManager.codeSchemeOrder.splice(schemeOrderIndex, 1);

        if (Object.keys(newDataset.schemes).length === 0) {
            // create new default coding scheme
            let newScheme = new CodeScheme(UIUtils.randomId([]) + "", "default", true);
            newScheme.codes.set(newScheme.id + "-" + "1", new Code(newScheme, newScheme.id + "-" + "1", "test", "#ffffff", "", false));
            newDataset.schemes[newScheme.id] = newScheme;

            messageViewerManager.codeSchemeOrder.push(newScheme.id + "");
            messageViewerManager.addNewSchemeColumn(newScheme);
            schemeId = newScheme.id;

            // save for UNDO and in storage
            undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);
            storage.saveDataset(newDataset);

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Deleted scheme " +  schemeId,
                "data": schemeSnapshot.toJSON(),
                "timestamp": new Date()
            });

            // in this case the default coding scheme was added and UI changes were already handled by addNewSchemeColumn
            return schemeId;

        } else {
            // save for UNDO and in storage
            undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);
            storage.saveDataset(newDataset);

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Deleted scheme " +  schemeId,
                "data": schemeSnapshot.toJSON(),
                "timestamp": new Date()
            });

            // UI changes need extra handling since there are multiple columns
            let newSchemeId = messageViewerManager.deleteSchemeColumn(schemeId);
            return newSchemeId;
        }
    }
};