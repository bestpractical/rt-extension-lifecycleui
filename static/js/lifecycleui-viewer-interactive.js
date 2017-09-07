jQuery(function () {
    var Super = RT.LifecycleViewer;

    function Interactive (container) {
        Super.call(this);
    };
    Interactive.prototype = Object.create(Super.prototype);

    Interactive.prototype._setMenuPosition = function () {
        if (!this.selectedStatus) {
            return;
        }

        var d = this.selectedStatus;
        var circle = this.statusContainer.select('circle[data-key="'+ d._key + '"]');
        var bbox = circle.node().getBoundingClientRect();
        var x = bbox.right + window.scrollX;
        var y = bbox.top + window.scrollY;

        this.selectedMenu.css({top: y, left: x});
    };

    Interactive.prototype.clickedStatus = function (d) {
        var statusName = d.name;
        this.selectedMenu = this.menuContainer.find('.status-menu[data-status="'+statusName+'"]');
        this.selectedStatus = d;

        this.menuContainer.find('.status-menu.selected').removeClass('selected');
        this.selectedMenu.addClass('selected');

        this._setMenuPosition();
    };

    Interactive.prototype.initializeViewer = function (node, name, config, focusStatus) {
         Super.prototype.initializeViewer.call(this, node, name, config, focusStatus);
         this.menuContainer = jQuery(node).find('.status-menus');
    };

    RT.LifecycleViewerInteractive = Interactive;
});

