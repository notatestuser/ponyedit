(function(window, document, ee) {
    'use strict';

    /* jshint validthis:true */
    var ponies = [];
    var wasCollapsed;
    var query = document.queryCommandValue.bind(document);
    var exec = document.execCommand.bind(document);
    var addEventListener = 'addEventListener';

    function find (element) {
        var i = 0;
        var len = ponies.length;
        var item;
        for(; i < len; i++) {
            item = ponies[i];
            if(item.element === element) {
                return item.editor;
            }
        }
    }

    function Editor (element, options) {
        var self = this;
        var opt = setOption.bind(self);

        ee.call(self, {
            wildcard: true // support wildcard listeners
        });

        self.state = { active: false };
        self.content = element;
        self.options = options || {};
        self.on('report.*', stateChange.bind(self));

        opt('htmlWrap', true);

        bindElements.call(self);
        buildPastebin.call(self);
        createEventBindings.call(self);

        ponies.push({ editor: self, element: element });
    }

    // extends EventEmitter2
    Editor.prototype = Object.create(ee.prototype);
    Editor.prototype.constructor = Editor;

    function setOption (name, defaultValue) {
        if (!(name in this.options)) {
            this.options[name] = defaultValue;
        }
    }

    function bindElements () {
        var self = this;
        var content = self.content;

        content.contentEditable = true;
        content.classList.add('py-editable');
    }

    function buildPastebin () {
        var self = this;
        var pastebin = document.createElement('textarea');
        pastebin.className = 'py-pastebin';
        self.pastebin = pastebin;

        document.body.appendChild(pastebin);
        document[addEventListener]('paste', pasteHandler.bind(self));
        document[addEventListener]('keydown', convertTabs.bind(self));
        document[addEventListener]('keypress', function (e) {

            if (((  (e.metaKey && !e.ctrlKey) ||
                    (e.ctrlKey && !e.metaKey)) && e.keyCode === 118)
                /* || (e.shiftKey && INSERT)*/) { // command-v, ctrl-v, shift-ins
                pasteHandler(e);
            }
        });
    }

    function pasteHandler (e) {
        var self = this;
        if (!isChildOf(self.content, e.target)) { return; }

        self.saveSelection();
        pastebin.focus();

        setTimeout(function () {
            self.restoreSelection(true);
            insertTextAtCaret(pastebin.value);
            pastebin.value = '';
        });
    }

    function convertTabs (e) {
        var self = this;
        if (!isChildOf(self.content, e.target)) { return; }

        if (e.keyCode === 9) {
            e.preventDefault();
            exec('insertHTML', false, '    ');
        }
    }

    function insertTextAtCaret (text) {
        var selection = window.getSelection();
        var range;
        var textNode;

        if (selection.getRangeAt && selection.rangeCount) {
            range = selection.getRangeAt(0);
            range.deleteContents();
            textNode = document.createTextNode(text);
            range.insertNode(textNode);
            selection.removeAllRanges();
            range = range.cloneRange();
            range.selectNode(textNode);
            range.collapse(false);
            selection.addRange(range);
        }
    }

    function createEventBindings () {
        var self = this;

        document[addEventListener]('keyup', function (e) {
            checkTextHighlighting.call(self, e);
        });
        document[addEventListener]('mousedown', function (e) {
            checkTextHighlighting.call(self, e);
        });
        document[addEventListener]('mouseup', function(e) {
            setTimeout(function () {
                checkTextHighlighting.call(self, e);
            }, 0);
        });
    }

    function checkTextHighlighting (e) {
        var self = this;

        if (isChildOf(self.popover, e.target) ||
            isChildOf(self.pickerContainer, e.target)) {
            return; // allow the event to go through
        }

        var selection = window.getSelection();
        self.saveSelection();

        // text is selected
        if (selection.isCollapsed === false) {
            self.currentNodeList = findNodes(self.content, selection.focusNode);

            // find if highlighting is in the editable area
            if (hasNode(self.currentNodeList, 'PONYEDIT')) {
                self.report();
            }
        }

        wasCollapsed = selection.isCollapsed;

        // report whether a selection exists
        self.emit('report.active', !wasCollapsed, 'active');
    }

    function findNodes (content, element) {
        var nodeNames = {};

        while (element.parentNode) {
            if (element === content ) {
                nodeNames.PONYEDIT = true;
            } else {
                nodeNames[element.nodeName] = true;
            }
            element = element.parentNode;
        }
        return nodeNames;
    }

    function isChildOf ( parent, element ) {

        while (element.parentNode) {
            if (element === parent) {
                return true;
            }
            if (element.parentNode === parent) {
                return true;
            }
            element = element.parentNode;
        }
    }

    function hasNode ( nodeList, name ) {
        return !!nodeList[name];
    }

    Editor.prototype.focus = function () {
        var range = document.createRange();
        var selection = window.getSelection();
        range.setStart(this.content, 0);
        selection.removeAllRanges();
        selection.addRange(range);
    };

    Editor.prototype.html = function (value) {
        var self = this;

        if (value === void 0) {
            return fix(self.content.innerHTML);
        } else {
            self.content.innerHTML = fix(value);
        }

        // wrap the HTML in a div.
        function fix (html) {
            if (self.options.htmlWrap === false) { return html; }

            if (html.substr(0,5) !== '<div>') {
                html = '<div>' + html + '</div>';
            }
            return html;
        }
    };

    Editor.prototype.getSelection = function () {
        var self = this, range;
        var selection = window.getSelection();
        if (selection.getRangeAt && selection.rangeCount) {
            range = selection.getRangeAt(0);

            // only return something if selection is inside editor
            if (isChildOf(self.content, range.commonAncestorContainer)) {
                return selection;
            }
        }
    };

    Editor.prototype.getRange = function () {
        var self = this, range;
        var selection = self.getSelection();
        return selection ? selection.getRangeAt(0) : void 0;
    };

    Editor.prototype.saveSelection = function () {
        var self = this;
        var range = self.getRange();
        if (range !== void 0) {
            self.lastRange = range;
        }
    };

    Editor.prototype.restoreSelection = function (forget) {
        var self = this;
        var selection;
        var range = self.lastRange;
        if (range) {
            selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            if (forget === true) {
                self.lastRange = null;
            }
        }
    };

    // pixel font size handling
    var pixelClass = 'py-pixels-element';

    function getPixels () {
        var sel = this.getSelection();
        if (!sel) {
            return;
        }
        var range = sel.getRangeAt(0);
        var parent = sel.focusNode.parentNode;
        var pixels = parent.classList.contains(pixelClass);
        if (pixels) {
            return getPixelSize(parent.style);
        }

        return getPixelSize(window.getComputedStyle(parent));
    }

    function getPixelSize (style) {
        return parseInt(style.fontSize.replace(/px/i, ''), 10);
    }

    function setPixels (value, offset) {
        var sel = this.getSelection();
        if (!sel) {
            return;
        }
        var range = sel.getRangeAt(0);
        var fragment = range.extractContents();
        var node = document.createElement('span');

        // untangle this mess, shouldn't be doing this here
        // rather, might be able to get away with just using recurse.
        // but I need to test that.
        // i.e rm up until line 310. and just recurse on fragment, then append it.
        setStyle(node);
        node.appendChild(fragment);
        range.insertNode(node);

        var poc = isPixelOnlyChild(node);
        if (poc) {
            // only child getting replaced! life so cruel
            dad.parentNode.replaceChild(node, dad);
        } else {
            recurse(node.childNodes);
        }

        function recurse (nodes) {
            _.each(nodes, function (node) {
                var poc, wrapper;

                if (node.nodeName === '#text') {
                    poc = isPixelOnlyChild(node);
                    if (poc) { // update pixel wrapper
                        setStyle(node.parentNode);
                    } else { // wrap in pixel tag
                        wrapper = document.createElement('span');
                        node.parentNode.replaceChild(wrapper, node);
                        wrapper.appendChild(node);
                        setStyle(wrapper, node.parentNode);
                    }
                } else {
                    recurse(node.childNodes);
                }
            });
        }

        function isPixelOnlyChild (node) {
            var dad = node.parentNode;
            return dad.classList.contains(pixelClass) && _.every(dad.children, function (n) {
                return n === node;
            });
        }

        function setStyle (node, reference) {
            var size = value;
            if (offset) {
                size += getPixelSize((reference || node).style);
            }
            node.classList.add(pixelClass);
            node.style.fontSize = size + 'px';
        }

        range.selectNode(node);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    // contentEditable commands

    Editor.prototype.execBold = function () {
        exec('bold', false);
    };
    Editor.prototype.execItalic = function () {
        exec('italic', false);
    };
    Editor.prototype.execSize = function (value) {
        if (this.options.pixels) {
            setPixels.call(this, value);
        } else {
            exec('fontSize', false, value);
        }
    };
    Editor.prototype.execSizeDecrease = function () {
        var value;

        if (this.options.pixels) {
            setPixels.call(this, -1, true);
        } else {
            value = queries.fontSize.call(this) - 1;
            exec('fontSize', false, value);
        }
    };
    Editor.prototype.execSizeIncrease = function () {
        var value;

        if (this.options.pixels) {
            setPixels.call(this, 1, true);
        } else {
            value = queries.fontSize.call(this) + 1;
            exec('fontSize', false, value);
        }
    };
    Editor.prototype.execType = function (value) {
        exec('fontName', false, value);
    };
    Editor.prototype.execColor = function (value) {
        exec('foreColor', false, value);
    };
    Editor.prototype.execAlignment = function (value) {
        var normalized = value[0].toUpperCase() + value.slice(1).toLowerCase();
        exec('justify' + normalized, false, null);
    };

    function command (action, prop) {
        return function (args, preserveSelection) {
            var self = this;
            self.restoreSelection(!preserveSelection);
            self['exec' + action].apply(self, args || []);
            self['report' + (prop || action)]();
        };
    }

    Editor.prototype.setBold = command('Bold');
    Editor.prototype.setItalic = command('Italic');
    Editor.prototype.setSize = command('Size');
    Editor.prototype.decreaseSize = command('SizeDecrease', 'Size');
    Editor.prototype.increaseSize = command('SizeIncrease', 'Size');
    Editor.prototype.setType = command('Type');
    Editor.prototype.setColor = command('Color');
    Editor.prototype.setAlignment = command('Alignment');

    // complex state queries
    var queries = {
        fontSize: function () {
            var value = this.options.pixels ?
                getPixels.call(this) :
                query('fontSize');

            return parseInt(value, 10);
        },
        alignment: function () {
            var lquery = query('justifyLeft');
            var cquery = query('justifyCenter');
            var rquery = query('justifyRight');
            if (lquery === 'true' || lquery === true) return 'left';
            if (cquery === 'true' || cquery === true) return 'center';
            if (rquery === 'true' || rquery === true) return 'right';
            return '';
        }
    };

    // property state emission

    function report (property, name, parse) {
        var rquotes = /^['"]|['"]$/g;
        var inspect = queries[property] || query;

        return function () {
            var self = this;
            var value = inspect.call(self, property);
            var ev = 'report.' + name;

            if (parse === 'bool') {
                value = value === 'true' || value === true;
            } else if (parse === 'int') {
                value = parseInt(value, 10);
            } else if (property === 'fontName') {
                value = value.replace(rquotes, '');
            }

            self.emit(ev, value, name);
            return value;
        };
    }

    function stateChange (value, prop) {
        var self = this;
        var key;

        if (prop === 'active' && value === false) {
            for (key in self.state) {
                delete self.state[prop];
            }
        }
        self.state[prop] = value;
    }

    Editor.prototype.reportBold = report('bold', 'bold', 'bool');
    Editor.prototype.reportItalic = report('italic', 'italic', 'bool');
    Editor.prototype.reportSize = report('fontSize', 'size', 'int');
    Editor.prototype.reportType = report('fontName', 'type');
    Editor.prototype.reportColor = report('foreColor', 'color');
    Editor.prototype.reportAlignment = report('alignment', 'alignment');
    Editor.prototype.report = function () {
        var self = this;
        self.reportBold();
        self.reportItalic();
        self.reportSize();
        self.reportType();
        self.reportColor();
        self.reportAlignment();
    };

    Editor.prototype.meta = {
        fontSizes: [1, 2, 3, 4, 5, 6, 7],
        fontPixels: [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 72],
        fontTypes: ['Arial', 'Arial Black', 'Comic Sans MS', 'Courier', 'Courier New', 'Georgia', 'Helvetica', 'Impact', 'Palatino', 'Times New Roman', 'Trebuchet MS', 'Verdana'],
        alignments: ['Left', 'Center', 'Right']
    };

    // lock down the meta options
    Object.freeze(Editor.prototype.meta);

    window.ponyedit = function (element) {
        if (element instanceof Editor) {
            return element;
        }
        return find(element);
    };

    window.ponyedit.meta = Editor.prototype.meta;
    window.ponyedit.init = function (element, options) {
        var instance = find(element);
        if (instance) {
            return instance;
        }
        return new Editor(element, options);
    };

})(window, document, EventEmitter2);
