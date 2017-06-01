!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.rangeslider=e()}}(function(){var define,module,exports;
/**
 * Creates a slider for picking intervals or numbers.
 *
 * A slider can be created with one or two draggable thumbs indicating the values.
 *
 * A slider with one thumb is created with
 *
 *   new RangeSlider(startInputElement)
 *
 * A slider with two thumbs is created with
 *
 *   new RangeSlider(startInputElement, endInputElement)
 *
 * The startInputElement must have a `min` attribute specified. If the slider has one thumb,
 * the startInputElement must also have a `max` attribute specified. Otherwise, the `max`
 * attribute must be specified on the endInputElement.
 *
 * The `step` attribute may be specified on the startInputElement, in which case values
 * will be set in steps.
 *
 * The `value` attribute may be specified on both elements, defining the initial value. If it's
 * not specified, the initial values will be set to the minimum and maximum values.
 *
 * The slider's interval will be the closed interval
 *
 *   [startInputElement.min, endInputElement.max]
 *
 * If the `data-unbounded-end` attribute is specified on one of the elements, the corresponding
 * end will be unbounded which means that the value of the element, upon reaching its maximum or
 * minimum value, will be set to the empty string.
 */

/*
TODO:
Handle division by zero
*/
(function() {
"use strict";

function RangeSlider(startInputEle, endInputEle, options) {
    if (!startInputEle) {
        throw Error("A start input element has to be specified.");
    }

    options = options || {};
    this._sliderEle = options.container;
    this._format = options.formatter || function(value) { return value; };
    this._output = options.output || this._setOutputValue;
    this._isRangeSlider = Boolean(endInputEle);
    this._activeThumb = null;
    this._pageX = 0;
    this._dragStartX = 0;
    this._handleMouseDown = this._handleMouseDown.bind(this);
    this._handleMouseUp = this._handleMouseUp.bind(this);
    this._handleMouseMove = this._handleMouseMove.bind(this);
    this._handleTouchStart = this._handleTouchStart.bind(this);
    this._handleTouchEnd = this._handleTouchEnd.bind(this);
    this._handleTouchMove = this._handleTouchMove.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._updateThumbPosition = this._updateThumbPosition.bind(this);

    if (!this._sliderEle) {
        this._createElements();
    }
    else {
        var thumbs = this._sliderEle.querySelectorAll(".finn-slider-thumb");
        this._startThumbEle = thumbs[0];
        this._endThumbEle = thumbs[1] || null;
        this._trackInnerEle = this._sliderEle.querySelector(".finn-slider-track-inner");
        this._outputEle = this._sliderEle.querySelector(".finn-slider-output");
    }

    if (this._isRangeSlider) {
        this._setupRangeSlider(startInputEle, endInputEle);
    }
    else {
        this._setupSlider(startInputEle);
    }

    this._output(this.startValue, this.endValue);
    startInputEle.parentNode.insertBefore(this._sliderEle, startInputEle);

    this.layout();

    window.addEventListener("resize", this.layout.bind(this));
}

RangeSlider.prototype = {
    /**
     * Sets the start value of the slider.
     */
    setStartValue: function(value) {
        if (typeof value != "number") {
            throw TypeError("Value must be a number.");
        }
        this._setStartValue(value);
        this._setStartThumbPosition(this._scaleValueToWidth(this.startValue));
    },

    /**
     * Sets the end value of the slider.
     */
    setEndValue: function(value) {
        if (typeof value != "number") {
            throw TypeError("Value must be a number.");
        }
        this._setEndValue(value);
        this._setEndThumbPosition(this._scaleValueToWidth(this.endValue));
    },

    getOutputValue: function(start, end) {
        var formattedStartValue = this._format(this._toFixed(start));
        var formattedEndValue = this._format(this._toFixed(end));
        var startLabel = this._outputLabel;
        var endLabel = this._outputLabel;
        var value;
        if (this._isRangeSlider) {
            if (start == this.minValue && this._startUnboundedOutputLabel) {
                startLabel = this._startUnboundedOutputLabel;
            }

            if (end == this.maxValue && this._endUnboundedOutputLabel) {
                endLabel = this._endUnboundedOutputLabel;
            }

            if ((end - start) == 0) {
                var label = start == this.minValue ? startLabel : endLabel;
                value = label.replace("{value}", formattedStartValue);
            }
            else {
                value = (startLabel.replace("{value}", formattedStartValue) + " – " +
                         endLabel.replace("{value}", formattedEndValue));
            }
        }
        else {
            if (start == this.maxValue && this._startUnboundedOutputLabel) {
                startLabel = this._startUnboundedOutputLabel;
            }

            value = startLabel.replace("{value}", formattedStartValue);
        }

        return value + " " + this._outputSuffix;
    },

    /**
     * Sets the size of the slider. In cases where the slider element has
     * display set to none while the slider initializes, this has to be run
     * after the display is set to something else.
     */
    layout: function() {
        this._sliderWidth = this._sliderEle.offsetWidth;
        this._sliderLeft = this._sliderEle.offsetLeft;
        this._thumbWidth = this._startThumbEle.offsetWidth;
        this._endThumbLeft = this._sliderWidth - this._thumbWidth;
        this._setStartThumbPosition(this._scaleValueToWidth(this.startValue));
        if (this._isRangeSlider) {
            this._setEndThumbPosition(this._scaleValueToWidth(this.endValue));
        }
    },

    // Simplistic implementation
    dispatchEvent: function(event) {
        this._sliderEle.dispatchEvent(event);
    },

    // Simplistic implementation
    addEventListener: function(type, callback, capture) {
        this._sliderEle.addEventListener(type, callback, capture || false);
    },

    // Simplistic implementation
    removeEventListener: function(type, callback, capture) {
        this._sliderEle.removeEventListener(type, callback, capture || false);
    },

    _setupSlider: function(startInputEle) {
        var step = startInputEle.step.trim();
        var isFraction = step.indexOf(".") != -1;
        this.minValue = Number(startInputEle.min);
        this.maxValue = Number(startInputEle.max);
        this.startValue = startInputEle.value != ""
                         ? this._clamp(Number(startInputEle.value), this.minValue, this.maxValue)
                         : this.minValue;
        this.endValue = this.maxValue;
        this._startInputEle = startInputEle;
        this._step = Number(step) || 1;
        this._fractionDigits = isFraction ? step.slice(step.indexOf(".") + 1).length : 0;
        this._outputLabel = startInputEle.getAttribute("data-output") || "{value}";
        this._outputSuffix = startInputEle.getAttribute("data-output-suffix") || "";
        var unboundedAttr = startInputEle.getAttribute("data-unbounded-end");
        this._isLeftUnboundedInterval = unboundedAttr != null && unboundedAttr != "false";
        this._startUnboundedOutputLabel = startInputEle.getAttribute("data-unbounded-output") || "{value}";

        if (!this._startThumbEle.hasAttribute("tabindex")) {
            this._startThumbEle.tabIndex = 0;
        }

        this._startThumbEle.setAttribute("role", "slider");
        this._startThumbEle.setAttribute("aria-valuemin", this.minValue);
        this._startThumbEle.setAttribute("aria-valuemax", this.maxValue);
        this._startThumbEle.setAttribute("aria-valuenow", this._toFixed(this.startValue));
        this._startThumbEle.setAttribute("aria-valuetext", this._toFixed(this.startValue));
        if (!this._startThumbEle.hasAttribute("aria-label")) {
            this._startThumbEle.setAttribute("aria-label", "Start");
        }

        this._trackInnerEle.style.right = "0";

        this._setStartInputValue(this.startValue);

        this._startInputEle.addEventListener("input", function(event) {
            this.setStartValue(Number(event.target.value));
        }.bind(this));

        this._startThumbEle.addEventListener("mousedown", this._handleMouseDown);
        this._startThumbEle.addEventListener("touchstart", this._handleTouchStart);
        this._startThumbEle.addEventListener("keydown", this._handleKeyDown);
    },

    _setupRangeSlider: function(startInputEle, endInputEle) {
        startInputEle.max = endInputEle.max;
        endInputEle.min = startInputEle.min;
        this._setupSlider(startInputEle);
        this.maxValue = Number(endInputEle.max);
        endInputEle.step = this._step;
        this.endValue = endInputEle.value != ""
                       // Clamping with min=startValue is intentional, to avoid endValue being lower than startValue
                       ? this._clamp(Number(endInputEle.value), this.startValue, this.maxValue)
                       : this.maxValue;
        this._endInputEle = endInputEle;
        var unboundedAttr = endInputEle.getAttribute("data-unbounded-end");
        this._isRightUnboundedInterval = unboundedAttr != null && unboundedAttr != "false";
        this._endUnboundedOutputLabel = endInputEle.getAttribute("data-unbounded-output") || "{value}";

        if (!this._endThumbEle.hasAttribute("tabindex")) {
            this._endThumbEle.tabIndex = 0;
        }

        this._endThumbEle.setAttribute("role", "slider");
        this._endThumbEle.setAttribute("aria-valuemin", this.minValue);
        this._endThumbEle.setAttribute("aria-valuemax", this.maxValue);
        this._endThumbEle.setAttribute("aria-valuenow", this._toFixed(this.endValue));
        this._endThumbEle.setAttribute("aria-valuetext", this._toFixed(this.endValue));
        if (!this._endThumbEle.hasAttribute("aria-label")) {
            this._endThumbEle.setAttribute("aria-label", "End");
        }

        this._endThumbEle.style.removeProperty("right");

        this._setEndInputValue(this.endValue);

        this._endInputEle.addEventListener("input", function(event) {
            this.setEndValue(Number(event.target.value));
        }.bind(this));

        this._endThumbEle.addEventListener("mousedown", this._handleMouseDown);
        this._endThumbEle.addEventListener("touchstart", this._handleTouchStart);
        this._endThumbEle.addEventListener("keydown", this._handleKeyDown);
    },

    _createElements: function() {
        this._sliderEle = document.createElement("div");
        this._sliderEle.className = "finn-slider";
        var trackEle = document.createElement("div");
        trackEle.className = "finn-slider-track";
        this._trackInnerEle = document.createElement("div");
        this._trackInnerEle.className = "finn-slider-track-inner";
        this._startThumbEle = document.createElement("div");
        this._startThumbEle.className = "finn-slider-thumb";
        this._outputEle = document.createElement("output");
        this._outputEle.className = "finn-slider-output";
        this._sliderEle.appendChild(trackEle);
        this._sliderEle.appendChild(this._trackInnerEle);
        this._sliderEle.appendChild(this._startThumbEle);
        if (this._isRangeSlider) {
            this._endThumbEle = document.createElement("div");
            this._endThumbEle.className = "finn-slider-thumb";
            this._sliderEle.appendChild(this._endThumbEle);
        }
        this._sliderEle.insertBefore(this._outputEle, this._sliderEle.firstChild);
    },

    _setStartValue: function(value) {
        var newValue = this._clamp(value, this.minValue, this.endValue);
        if (this.startValue != value) {
            this.startValue = newValue;
            this._output(newValue, this.endValue);
            this._setStartInputValue(newValue);
            this._startThumbEle.setAttribute("aria-valuenow", this._toFixed(newValue));
            this._startThumbEle.setAttribute("aria-valuetext", this._toFixed(newValue));
        }
    },

    _setEndValue: function(value) {
        var newValue = this._clamp(value, this.startValue, this.maxValue);
        if (this.endValue != value) {
            this.endValue = newValue;
            this._output(this.startValue, newValue);
            this._setEndInputValue(newValue);
            this._endThumbEle.setAttribute("aria-valuenow", this._toFixed(newValue));
            this._endThumbEle.setAttribute("aria-valuetext", this._toFixed(newValue));
        }
    },

    _setStartInputValue: function(value) {
        if (value == this.minValue && this._isLeftUnboundedInterval) {
            value = "";
        }
        else {
            value = this._toFixed(value);
        }
        this._startInputEle.value = value;
        this._fireSyntheticEvent("input", "start");
    },

    _setEndInputValue: function(value) {
        if (value == this.maxValue && this._isRightUnboundedInterval) {
            value = "";
        }
        else {
            value = this._toFixed(value);
        }
        this._endInputEle.value = value;
        this._fireSyntheticEvent("input", "end");
    },

    _setOutputValue: function(start, end) {
        this._outputEle.textContent = this.getOutputValue(start, end);
    },

    _setStartThumbPosition: function(value) {
        this._startThumbLeft = value;
        this._startThumbEle.style.left = value.toFixed(1) + "px";
        this._trackInnerEle.style.left = (value + (this._thumbWidth / 2)).toFixed(1) + "px";
    },

    _setEndThumbPosition: function(value) {
        this._endThumbLeft = value;
        this._endThumbEle.style.left = value.toFixed(1) + "px";
        this._trackInnerEle.style.right = (this._sliderWidth - value - (this._thumbWidth / 2)).toFixed(1) + "px";
    },

    _updateThumbPosition: function() {
        // TODO: clean this up
        var thumbLeft = this._pageX - this._sliderLeft - this._dragStartX;
        var thumbPercent = thumbLeft / (this._sliderWidth - this._thumbWidth);
        var value = this.minValue + ((this.maxValue - this.minValue) * thumbPercent);
        var stepValue = Math.round(value / this._step) * this._step;
        if (this._activeThumb == this._startThumbEle) {
            this._setStartValue(stepValue);
            this._setStartThumbPosition(this._clamp(thumbLeft, 0, this._endThumbLeft));
        }
        else if (this._activeThumb == this._endThumbEle) {
            this._setEndValue(stepValue);
            this._setEndThumbPosition(this._clamp(thumbLeft, this._startThumbLeft, this._sliderWidth - this._thumbWidth));
        }
    },

    _handleMouseDown: function(event) {
        event.stopPropagation();
        event.preventDefault();

        if (event.button != 0) {
            return;
        }

        var target = event.target;
        // Could be event.offsetX, but not all browsers support
        this._dragStartX = event.pageX - target.offsetLeft - this._sliderLeft;
        this._pageX = event.pageX;

        // TODO: within some threshold?
        if (this._isRangeSlider && this._startThumbLeft == this._endThumbLeft) {
            this._observeMouseMoveDirection(target, event.pageX);
        }

        this._addMouseListeners(target);
    },

    _handleMouseUp: function(event) {
        event.stopPropagation();

        // TODO: only update if some value has changed
        this._fireSyntheticEvent("change", this._getActiveThumbLabel());
        this._removeTemporaryStyles(this._activeThumb);
        this._activeThumb = null;
        this._dragStartX = 0;
        document.removeEventListener("mouseup", this._handleMouseUp);
        document.removeEventListener("mousemove", this._handleMouseMove);
    },

    _handleMouseMove: function(event) {
        event.stopPropagation();
        event.preventDefault();

        this._pageX = event.pageX;
        this._updateThumbPosition();
    },

    _handleTouchStart: function(event) {
        event.stopPropagation();
        event.preventDefault();

        // Prevent more than one touch on the same slider
        if (this._activeThumb) {
            return;
        }

        var target = event.target;
        var touch = event.targetTouches[0];
        this._dragStartX = touch.pageX - target.offsetLeft - this._sliderLeft;
        this._pageX = touch.pageX;

        // TODO: within some threshold?
        if (this._isRangeSlider && this._startThumbLeft == this._endThumbLeft) {
            this._observeTouchMoveDirection(target, touch.pageX);
        }

        // We want to skip the next mousedown handler at this point, we'll
        // add it back later.
        // Just set a skipNextMouseDown flag instead?
        target.removeEventListener("mousedown", this._handleMouseDown);

        this._addTouchListeners(target);
    },

    _handleTouchEnd: function(event) {
        event.stopPropagation();

        // TODO: only update if some value has changed
        this._fireSyntheticEvent("change", this._getActiveThumbLabel());
        this._removeTemporaryStyles(this._activeThumb);
        this._activeThumb = null;
        this._dragStartX = 0;
        var target = event.target;
        target.addEventListener("mousedown", this._handleMouseDown);
        target.removeEventListener("touchend", this._handleTouchEnd);
        target.removeEventListener("touchcancel", this._handleTouchEnd);
        target.removeEventListener("touchmove", this._handleTouchMove);
    },

    _handleTouchMove: function(event) {
        event.stopPropagation();
        event.preventDefault();

        var touches = event.targetTouches;
        var touch = touches[0];
        if (!touch) { // TODO: can this ever happen?
            return;
        }

        this._pageX = touch.pageX;
        this._updateThumbPosition();
    },

    _handleKeyDown: function(event) {
        event.stopPropagation();

        var isStartThumb = event.target == this._startThumbEle;
        var value = isStartThumb ? this.startValue : this.endValue;

        switch (event.key || event.keyIdentifier) {
            case "Left":
            case "Down":
                value -= this._step;
                break;

            case "Right":
            case "Up":
                value += this._step;
                break;

            case "PageDown":
                value -= this._step * 10;
                break;

            case "PageUp":
                value += this._step * 10;
                break;

            case "Home":
                value = this.minValue;
                break;

            case "End":
                value = this.maxValue;
                break;

            default:
                return;
        }

        if (isStartThumb) {
            this.setStartValue(value);
        }
        else {
            this.setEndValue(value);
        }

        this._fireSyntheticEvent("change", isStartThumb ? "start" : "end");
        event.preventDefault();
    },

    _addMouseListeners: function(target) {
        this._activeThumb = target;
        this._addTemporaryStyles(target);
        document.addEventListener("mouseup", this._handleMouseUp);
        document.addEventListener("mousemove", this._handleMouseMove);
    },

    _addTouchListeners: function(target) {
        this._activeThumb = target;
        this._addTemporaryStyles(target);
        target.addEventListener("touchend", this._handleTouchEnd);
        target.addEventListener("touchcancel", this._handleTouchEnd);
        target.addEventListener("touchmove", this._handleTouchMove);
    },

    _observeMouseMoveDirection: function(target, start) {
        var handleMouseMove = function(event) {
            var actualTarget = event.pageX < start
                             ? this._startThumbEle
                             : this._endThumbEle;
            target.removeEventListener("mousemove", handleMouseMove);
            this._removeTemporaryStyles(target);
            this._addMouseListeners(actualTarget);
        }.bind(this);
        target.addEventListener("mousemove", handleMouseMove);
    },

    _observeTouchMoveDirection: function(target, start) {
        var handleTouchMove = function(event) {
            var actualTarget = event.targetTouches[0].pageX < start
                             ? this._startThumbEle
                             : this._endThumbEle;
            target.removeEventListener("touchmove", handleTouchMove);
            this._removeTemporaryStyles(target);
            this._addTouchListeners(actualTarget);
        }.bind(this);
        target.addEventListener("touchmove", handleTouchMove);
    },

    _getActiveThumbLabel: function() {
        return this._activeThumb == this._startThumbEle ? "start" : "end";
    },

    _addTemporaryStyles: function(target) {
        var style = target.style;
        style.setProperty("z-index", "1");
        style.setProperty("-webkit-backface-visibility", "hidden");
        style.setProperty("backface-visibility", "hidden");
    },

    _removeTemporaryStyles: function(target) {
        var style = target.style;
        style.removeProperty("z-index");
        style.removeProperty("-webkit-backface-visibility");
        style.removeProperty("backface-visibility");
    },

    _fireSyntheticEvent: function(type, which) {
        var event = document.createEvent("CustomEvent");
        var isStart = which == "start";
        var details = {
            changedInput: isStart ? this._startInputEle : this._endInputEle,
            changedValue: isStart ? this.startValue : this.endValue
        };
        event.initCustomEvent(type, true, true, details);
        this._sliderEle.dispatchEvent(event);
    },

    _toFixed: function(value) {
        return value.toFixed(this._fractionDigits);
    },

    _scaleValueToWidth: function(value) {
        var valueIntervalLength = this.maxValue - this.minValue;
        return (value - this.minValue) * (this._sliderWidth - this._thumbWidth) / valueIntervalLength;
    },

    _clamp: function(actual, min, max) {
        return Math.min(Math.max(actual, min), max);
    }
};

window.RangeSlider = RangeSlider;

}());

});