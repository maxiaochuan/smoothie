import Util from './Util';
import TimeSeries, { TimeSeriesOptions, TimeSeriesExtraOptions } from './TimeSeries';
import { SmoothieChartOptions, DEFAULT_OPTIONS } from './_const';

export default class SmoothieChart {
  private options: SmoothieChartOptions;

  private _canvas?: HTMLCanvasElement;

  private get canvas() {
    if (!this._canvas) {
      throw new Error('canvas is not init');
    }
    return this._canvas;
  }

  private set canvas(v: HTMLCanvasElement) {
    this._canvas = v;
  }

  private get context() {
    if (!this._canvas) {
      throw new Error('canvas is not init');
    }
    return this._canvas.getContext('2d')!;
  }

  private frameId: number = 0;

  private clientWidth: number = 0;

  private clientHeight: number = 0;

  private delay: number = 0;

  /**
   * @description 对齐数据时间点到当前时间点
   * @author Xiaochuan Ma <mxcins@gmail.com>
   * @date 2023-06-11
   * @private
   * @type {number}
   * @memberof SmoothieChart
   */
  private offset: number = 0;

  /**
   * @description 每帧时间，毫秒
   * @author Xiaochuan Ma <mxcins@gmail.com>
   * @date 2023-06-10
   * @private
   * @type {number}
   * @memberof SmoothieChart
   */
  private frameTime: number = 0;
  /**
   * @description 最后渲染的真实时间, 毫秒
   * @author Xiaochuan Ma <mxcins@gmail.com>
   * @date 2023-06-10
   * @private
   * @type {number}
   * @memberof SmoothieChart
   */
  private lastRenderTime: number;
  /**
   * @description 最后渲染图表的时间戳, 毫秒
   * @author Xiaochuan Ma <mxcins@gmail.com>
   * @date 2023-06-10
   * @private
   * @type {number}
   * @memberof SmoothieChart
   */
  private lastChartTime: number;

  /**
   * @description 每像素有多少毫秒
   * @author Xiaochuan Ma <mxcins@gmail.com>
   * @date 2023-06-10
   * @private
   * @type {number}
   * @memberof SmoothieChart
   */
  private millisPerPixel: number = 0;

  /**
   * @description 纵向Grid Line 占用多少时间,毫秒
   * @author Xiaochuan Ma <mxcins@gmail.com>
   * @date 2023-06-10
   * @private
   * @type {number}
   * @memberof SmoothieChart
   */
  private millisPerLine: number = 0;

  private series: Set<TimeSeries> = new Set();

  private value: { min: number; max: number; range: number } = {
    min: Number.NaN,
    max: Number.NaN,
    range: Number.NaN,
  };

  private state: { range: number; min: number; isAnimatingScale: boolean } = {
    isAnimatingScale: false,
    range: 1,
    min: 0,
  };

  private cache: { lastWidth: number; lastHeight: number } = {
    lastWidth: 0,
    lastHeight: 0,
  };

  constructor(options: Partial<SmoothieChartOptions> = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      labels: {
        ...DEFAULT_OPTIONS.labels,
        ...options.labels,
      },
      grid: {
        ...DEFAULT_OPTIONS.grid,
        ...options.grid,
      },
    };
    if (this.options.limitFPS) {
      this.frameTime = 1000 / this.options.limitFPS;
    }
  }

  public streamTo(canvas: HTMLCanvasElement, delay: number) {
    this.canvas = canvas;
    this.resize();
    // this.delay = delay || 0;
    this.start();
  }

  public add(series: TimeSeries, options: TimeSeriesExtraOptions) {
    this.series.add(series.setExtraOptions(options));
    if (series.options.resetBounds && series.options.resetBoundsInterval > 0) {
      series.resetBoundsTimerId = setInterval(
        () => series.resetBounds(),
        series.options.resetBoundsInterval,
      );
    }
  }

  /**
   * Removes the specified <code>TimeSeries</code> from the chart.
   */
  public remove(series: TimeSeries) {
    // Find the correct timeseries to remove, and remove it
    // var numSeries = this.seriesSet.length;
    // for (var i = 0; i < numSeries; i++) {
    //   if (this.seriesSet[i].timeSeries === timeSeries) {
    //     this.seriesSet.splice(i, 1);
    //     break;
    //   }
    // }
    this.series.delete(series);
    // If a timer was operating for that timeseries, remove it
    if (series.resetBoundsTimerId) {
      // Stop resetting the bounds, if we were
      clearInterval(series.resetBoundsTimerId);
    }
  }

  public start() {
    if (this.frameId) return;
    const animate = () => {
      this.frameId = requestAnimationFrame(() => {
        if(this.options.nonRealtimeData){
           const dateZero = 0;
           // find the data point with the latest timestamp
           var maxTimeStamp = [...this.series].reduce((max, series) => {
             const dataSet = series.data;
             var indexToCheck = Math.round(dataSet.length) - 1;
             indexToCheck = indexToCheck >= 0 ? indexToCheck : 0;
             indexToCheck = indexToCheck <= dataSet.length -1 ? indexToCheck : dataSet.length -1;
             if(dataSet && dataSet.length > 0)
             {
              // timestamp corresponds to element 0 of the data point
              var lastDataTimeStamp = dataSet[indexToCheck][0];
              max = max > lastDataTimeStamp ? max : lastDataTimeStamp;
             }
             return max;
          }, dateZero);
          if (maxTimeStamp !== 0 && this.offset === 0) {
            this.offset = Date.now() - maxTimeStamp;
          }
          // use the max timestamp as current time
          // this.render(maxTimeStamp > dateZero ? maxTimeStamp : null);
          // TODO: offset delay
          this.render(Date.now() - this.offset - 500)
        } else {
        this.render();
        }
        animate();
      });
    };

    animate();
  }

  public stop() {
    if (this.frameId) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = 0;
      this.offset = 0;
    }
  }

  private render(timestamp?: number | null) {
    const now = Date.now();
    // 帧率限制
    if (this.options.limitFPS > 0 && now - this.lastRenderTime < this.frameTime) return;

    let time = (timestamp || now) - this.delay;
    // 时间平滑
    time -= time % this.millisPerPixel;

    // if (!this.isAnimatingScale) {
    //   // We're not animating. We can use the last render time and the scroll speed to work out whether
    //   // we actually need to paint anything yet. If not, we can return immediately.
    //   var sameTime = this.lastChartTimestamp === time;
    //   if (sameTime) {
    //     // Render at least every 1/6th of a second. The canvas may be resized, which there is
    //     // no reliable way to detect.
    //     var needToRenderInCaseCanvasResized = now - this.lastRenderTime > 1000/6;
    //     if (!needToRenderInCaseCanvasResized) {
    //       console.log('return');
    //       return;
    //     }
    //   }
    // }

    this.lastRenderTime = now;
    this.lastChartTime = time;

    this.resize();

    if (!this.canvas) return;

    // 绘图范围
    const dimensions = { top: 0, left: 0, width: this.clientWidth, height: this.clientHeight };

    // 最早有效时间
    const oldestValidTime = time - dimensions.width * this.millisPerPixel;

    const v2y = (v: number, lineWidth: number) => {
      const offset = v - this.state.min;
      const y = dimensions.height * (1 - offset / this.state.range);
      return Util.pixelSnap(y, lineWidth);
    };

    const t2x = (t: number, lineWidth: number) => {
      // Why not write it as `(time - t) / chartOptions.millisPerPixel`:
      // If a datapoint's `t` is very close or is at the center of a pixel, that expression,
      // due to floating point error, may take value whose `% 1` sometimes is very close to
      // 0 and sometimes is close to 1, depending on the value of render time (`time`),
      // which would make `pixelSnap` snap it sometimes to the right and sometimes to the left,
      // which would look like it's jumping.
      // You can try the default examples, with `millisPerPixel = 100 / 3` and
      // `grid.lineWidth = 1`. The grid would jump.
      // Writing it this way seems to avoid such inconsistency because in the above example
      // `offset` is (almost?) always a whole number.
      // TODO Maybe there's a more elegant (and reliable?) way.
      const offset = time / this.millisPerPixel - t / this.millisPerPixel;
      const x = this.options.reverse ? offset : dimensions.width - offset;
      return Util.pixelSnap(x, lineWidth);
    };

    this.update();

    const context = this.context;

    context.font = this.options.labels.fontSize + 'px ' + this.options.labels.fontFamily;

    // Save the state of the canvas context, any transformations applied in this method
    // will get removed from the stack at the end of this method when .restore() is called.
    context.save();

    // Move the origin.
    context.translate(dimensions.left, dimensions.top);

    // Create a clipped rectangle - anything we draw will be constrained to this rectangle.
    // This prevents the occasional pixels from curves near the edges overrunning and creating
    // screen cheese (that phrase should need no explanation).
    context.beginPath();
    context.rect(0, 0, dimensions.width, dimensions.height);
    context.clip();

    const { grid } = this.options;

    // Clear the working area.
    context.save();
    context.fillStyle = grid.fillStyle;
    context.clearRect(0, 0, dimensions.width, dimensions.height);
    context.fillRect(0, 0, dimensions.width, dimensions.height);
    context.restore();

    // Grid lines...
    context.save();
    context.lineWidth = grid.lineWidth;
    context.strokeStyle = grid.strokeStyle;

    // Vertical (time) dividers.
    if (this.millisPerLine > 0) {
      context.beginPath();
      for (var t = time - (time % this.millisPerLine); t >= oldestValidTime; t -= this.millisPerLine) {
        var gx = t2x(t, grid.lineWidth);
        context.moveTo(gx, 0);
        context.lineTo(gx, dimensions.height);
      }
      context.stroke();
    }

    // Horizontal (value) dividers.
    for (let v = 1; v < grid.verticalSections; v += 1) {
      var gy = Util.pixelSnap((v * dimensions.height) / grid.verticalSections, grid.lineWidth);
      context.beginPath();
      context.moveTo(0, gy);
      context.lineTo(dimensions.width, gy);
      context.stroke();
    }
    // Grid border
    if (grid.border) {
      context.strokeRect(0, 0, dimensions.width, dimensions.height);
    }
    context.restore();

    // //TODO: Draw any horizontal lines...
    // if (chartOptions.horizontalLines && chartOptions.horizontalLines.length) {
    //   for (var hl = 0; hl < chartOptions.horizontalLines.length; hl++) {
    //     var line = chartOptions.horizontalLines[hl],
    //         lineWidth = line.lineWidth || 1,
    //         hly = valueToYPosition(line.value, lineWidth);
    //     context.strokeStyle = line.color || '#ffffff';
    //     context.lineWidth = lineWidth;
    //     context.beginPath();
    //     context.moveTo(0, hly);
    //     context.lineTo(dimensions.width, hly);
    //     context.stroke();
    //   }
    // }

    // For each data set...
    this.series.forEach(series => {
      const dataset = series.data;
      series.removeOldData(oldestValidTime, this.options.maxDataSetLength);
      if (dataset.length < 2 || series.disabled) return;

      context.save();

      const drawStroke = series.options.strokeStyle && series.options.strokeStyle !== 'none';
      // TODO: ???
      const lineWidthMaybeZero = drawStroke ? series.options.lineWidth : 0;

      // Draw the line...
      context.beginPath();
      const firstX = t2x(dataset[0][0], lineWidthMaybeZero);
      const firstY = v2y(dataset[0][1], lineWidthMaybeZero);
      let lastX = firstX;
      let lastY = firstY;

      context.moveTo(firstX, firstY);
      const draw = this.getDrawLineFn(series);

      dataset.forEach(([t, v]) => {
        const x = t2x(t, lineWidthMaybeZero);
        const y = v2y(v, lineWidthMaybeZero);
        draw(x, y, lastX, lastY);
        lastX = x;
        lastY = y;
      });

      if (drawStroke) {
        context.lineWidth = series.options.lineWidth;
        context.strokeStyle = series.options.strokeStyle;
        context.stroke();
      }

      if (series.options.fillStyle) {
        // Close up the fill region.
        var fillEndY = series.options.fillToBottom
          ? dimensions.height + lineWidthMaybeZero + 1
          : v2y(0, 0);
        context.lineTo(lastX, fillEndY);
        context.lineTo(firstX, fillEndY);

        context.fillStyle = series.options.fillStyle;
        context.fill();
      }

      context.restore();
    });
  }

  private getDrawLineFn(series: TimeSeries): (x: number, y: number, lx: number, ly: number) => void {
    const context = this.context;
    switch (series.options.interpolation || this.options.interpolation) {
      case 'line':
      case 'linear': {
        return (x: number, y: number, lx: number, ly: number) => {
          context.lineTo(x, y);
        };
      }
      case 'bezier':
      default: {
        return (x: number, y: number, lx: number, ly: number) => {
          context.bezierCurveTo(
            // startPoint (A) is implicit from last iteration of loop
            Math.round((lx + x) / 2),
            ly, // controlPoint1 (P)
            Math.round(lx + x) / 2,
            y, // controlPoint2 (Q)
            x,
            y,
          ); // endPoint (B)
        };
      }
      case 'step': {
        return (x: number, y: number, lx: number, ly: number) => {
          context.lineTo(x, ly);
          context.lineTo(x, y);
        };
      }
    }
  }

  private update() {
    let max = Number.NaN;
    let min = Number.NaN;

    this.series.forEach(series => {
      if (series.disabled) return;
      if (!Number.isNaN(series.max)) {
        max = !Number.isNaN(max) ? Math.max(max, series.max) : series.max;
      }
      if (!Number.isNaN(series.min)) {
        min = !Number.isNaN(min) ? Math.min(min, series.min) : series.min;
      }
    });

    if (this.options.max !== undefined) {
      max = this.options.max;
    } else {
      max *= this.options.maxValueScale;
    }

    if (this.options.min !== undefined) {
      min = this.options.min;
    } else {
      min -= Math.abs(min * this.options.minValueScale - min);
    }

    // If a custom range function is set, call it
    // if (this.options.yRangeFunction) {
    //   var range = this.options.yRangeFunction({min: chartMinValue, max: chartMaxValue});
    //   chartMinValue = range.min;
    //   chartMaxValue = range.max;
    // }

    if (!Number.isNaN(max) && !Number.isNaN(min)) {
      const range = max - min;
      const rangeDiff = range - this.state.range;
      var minDiff = min - this.state.min;

      this.state.isAnimatingScale = Math.abs(rangeDiff) > 0.1 || Math.abs(minDiff) > 0.1;
      this.state.range += this.options.scaleSmoothing * rangeDiff;
      this.state.min += this.options.scaleSmoothing * minDiff;
    }

    this.value = { min, max, range: max - min };
  }

  private resize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio;
    // Newer behaviour: Use the canvas's size in the layout, and set the internal
    // resolution according to that size and the device pixel ratio (eg: high DPI)
    const width = this.canvas.offsetWidth;
    const height = this.canvas.offsetHeight;

    if (width !== this.cache.lastWidth) {
      this.cache.lastWidth = width;
      this.canvas.setAttribute('width', Math.floor(width * dpr).toString());
      this.canvas.getContext('2d')!.scale(dpr, dpr);
    }
    if (height !== this.cache.lastHeight) {
      this.cache.lastHeight = height;
      this.canvas.setAttribute('height', Math.floor(height * dpr).toString());
      this.canvas.getContext('2d')!.scale(dpr, dpr);
    }

    this.clientWidth = width;
    this.clientHeight = height;
    this.millisPerPixel = this.options.duration / this.clientWidth;
    this.millisPerLine = this.options.duration / this.options.grid.horizontalSections;
  }
}
