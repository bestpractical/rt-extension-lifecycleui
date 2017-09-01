jQuery(function () {
    var Super = RT.LifecycleViewer;

    function Editor (container) {
        Super.call(this);
        this.padding = this.statusCircleRadius * 2;
    };
    Editor.prototype = Object.create(Super.prototype);

    Editor.prototype._initializeTemplates = function (container) {
        var self = this;

        Handlebars.registerHelper('select', function(value, options) {
            var node = jQuery('<select />').html( options.fn(this) );
            node.find('[value="' + value + '"]').attr({'selected':'selected'});
            return node.html();
        });

        Handlebars.registerHelper('canAddTransition', function(fromStatus, toStatus, lifecycle) {
            if (fromStatus == toStatus) {
                return false;
            }
            return !lifecycle.hasTransition(fromStatus, toStatus);
        });

        Handlebars.registerHelper('canSelectTransition', function(fromStatus, toStatus, lifecycle) {
            return lifecycle.hasTransition(fromStatus, toStatus);
        });

        var templates = {};
        self.container.find('script.lifecycle-inspector-template').each(function () {
            var type = jQuery(this).data('type');
            var template = jQuery(this).html();
            var fn = Handlebars.compile(template);
            templates[type] = fn;
            Handlebars.registerPartial('lifecycleui_' + type, fn);
        });
        return templates;
    };

    Editor.prototype.setInspectorContent = function (node) {
        var self = this;
        var lifecycle = self.lifecycle;
        var inspector = self.inspector;

        var type = node ? node._type : 'canvas';

        var params = { lifecycle: lifecycle };
        params[type] = node;

        inspector.html(self.templates[type](params));
        inspector.find('sf-menu').supersubs().superfish({ dropShadows: false, speed: 'fast', delay: 0 }).supposition()

        inspector.find(':input').change(function () {
            var field = this.name;
            var value;
            if (jQuery(this).is(':checkbox')) {
                value = this.checked;
            }
            else {
                value = jQuery(this).val();
            }

            var action = jQuery(this).closest('li.action');
            if (action.length) {
                var action = lifecycle.itemForKey(action.data('key'));
                lifecycle.updateItem(action, field, value);
            }
            else {
                lifecycle.updateItem(node, field, value);
            }
            self.renderDisplay();
        });

        inspector.find('button.change-color').click(function (e) {
            e.preventDefault();
            var picker = jQuery('<div class="color-picker"></div>');
            jQuery(this).replaceWith(picker);

            var skipUpdateCallback = 0;
            var farb = jQuery.farbtastic(picker, function (newColor) {
                if (skipUpdateCallback) {
                    return;
                }
                inspector.find('.current-color').val(newColor);
                lifecycle.updateItem(node, 'color', newColor);
                self.renderDisplay();
            });
            farb.setColor(node.color);

            var input = jQuery('<input class="current-color" size=8 maxlength=7>');
            inspector.find('.current-color').replaceWith(input);
            input.on('input', function () {
                var newColor = input.val();
                if (newColor.match(/^#[a-fA-F0-9]{6}$/)) {
                    skipUpdateCallback = 1;
                    farb.setColor(newColor);
                    skipUpdateCallback = 0;

                    lifecycle.updateItem(node, 'color', newColor);
                    self.renderDisplay();
                }
            });
            input.val(node.color);
        });

        inspector.find('button.delete').click(function (e) {
            e.preventDefault();
            lifecycle.deleteItemForKey(node._key);

            self.deselectAll(true);
            self.renderDisplay();
        });

        inspector.find('a.add-transition').click(function (e) {
            e.preventDefault();
            var button = jQuery(this);
            var fromStatus = button.data('from');
            var toStatus   = button.data('to');

            lifecycle.addTransition(fromStatus, toStatus);

            button.closest('li').addClass('hidden');

            inspector.find('a.select-transition[data-from="'+fromStatus+'"][data-to="'+toStatus+'"]').closest('li').removeClass('hidden');

            self.renderDisplay();
            self.selectStatus(node.name);
        });

        inspector.find('a.select-status').on('click', function (e) {
            e.preventDefault();
            var statusName = jQuery(this).data('name');
            self.selectStatus(statusName);
        });

        inspector.find('a.select-transition').on('click', function (e) {
            e.preventDefault();
            var button = jQuery(this);
            var fromStatus = button.data('from');
            var toStatus   = button.data('to');

            self.selectTransition(fromStatus, toStatus);
        });
    };

    Editor.prototype.deselectAll = function (clearSelection) {
        var svg = this.svg;
        svg.classed('selection', false);
        svg.selectAll('.selected').classed('selected', false);
        svg.selectAll('.selected-source').classed('selected-source', false);
        svg.selectAll('.selected-sink').classed('selected-sink', false);
        svg.selectAll('.reachable').classed('reachable', false);

        if (clearSelection) {
            this.setInspectorContent(null);
        }
    };

    Editor.prototype.selectStatus = function (name) {
        var self = this;
        var d = self.lifecycle.statusObjectForName(name);

        self.deselectAll(false);

        self.svg.classed('selection', true);
        self.statusContainer.selectAll('*[data-key="'+d._key+'"]').classed('selected', true);

        jQuery.each(self.lifecycle.transitionsFrom(name), function (i, transition) {
            var key = self.lifecycle.keyForStatusName(transition.to);
            self.statusContainer.selectAll('*[data-key="'+key+'"]').classed('reachable', true);
            self.transitionContainer.selectAll('path[data-key="'+transition._key+'"]').classed('selected', true);
        });

        self.setInspectorContent(d);
    };

    Editor.prototype.selectTransition = function (fromStatus, toStatus) {
        var self = this;
        var d = self.lifecycle.hasTransition(fromStatus, toStatus);

        self.deselectAll(false);

        self.svg.classed('selection', true);

        var fromKey = self.lifecycle.keyForStatusName(fromStatus);
        var toKey = self.lifecycle.keyForStatusName(toStatus);
        self.statusContainer.selectAll('*[data-key="'+fromKey+'"]').classed('selected-source', true);
        self.statusContainer.selectAll('*[data-key="'+toKey+'"]').classed('selected-sink', true);
        self.transitionContainer.select('path[data-key="'+d._key+'"]').classed('selected', true);

        self.setInspectorContent(d);
    };

    Editor.prototype.selectDecoration = function (key) {
        var d = this.lifecycle.itemForKey(key);

        this.deselectAll(false);

        this.svg.classed('selection', true);
        this.decorationContainer.selectAll('*[data-key="'+key+'"]').classed('selected', true);
        this.setInspectorContent(d);
    };

    Editor.prototype.clickedStatus = function (d) {
        this.selectStatus(d.name);
    };

    Editor.prototype.clickedTransition = function (d) {
        this.selectTransition(d.from, d.to);
    };

    Editor.prototype.clickedDecoration = function (d) {
        this.selectDecoration(d._key);
    };

    Editor.prototype.initializeEditor = function (node, config) {
        var self = this;
        self.initializeViewer(node, config);

        self.templates = self._initializeTemplates(self.container);
        self.inspector = self.container.find('.inspector');

        self.setInspectorContent(null);

        self.container.closest('form[name=ModifyLifecycle]').submit(function (e) {
            e.preventDefault();
            var config = self.lifecycle.exportAsConfiguration();
            console.log(config);
            return false;
        });

        self.svg.on('click', function () { self.deselectAll(true) });
    };

    RT.LifecycleEditor = Editor;
});
