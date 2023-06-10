interface SmoothieChartOptions {
    /**
     * @description 图表是否自适应画布大小
     * @author Xiaochuan Ma <mxcins@gmail.com>
     * @date 2023-06-10
     * @type {boolean}
     * @default {true}
     * @memberof SmoothieChartOptions
     */
    responsive: boolean;

    /**
     * @description 设置最大帧数, 为0则不限制, FPS
     * @author Xiaochuan Ma <mxcins@gmail.com>
     * @date 2023-06-10
     * @type {number}
     * @memberof SmoothieChartOptions
     */
    frameRate: number;
}

const defaults: SmoothieChartOptions = {
  responsive: true,
  frameRate: 0,
}

export default class SmoothieChart {
  private options: SmoothieChartOptions;

  private canvas?: HTMLCanvasElement;

  private clientWidth: number = 0;

  private clientHeight: number = 0;

  private delay: number = 0;

  private frame: number = 0;

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
   * @description 最后渲染的时间, 毫秒
   * @author Xiaochuan Ma <mxcins@gmail.com>
   * @date 2023-06-10
   * @private
   * @type {number}
   * @memberof SmoothieChart
   */
  private lastRenderTime: number;

  constructor(options: Partial<SmoothieChart> = {}) {
    this.options = { ...defaults, ...options }
    if (this.options.frameRate) {
      this.frameTime = (1000 / this.options.frameRate);
    }
  }

  public streamTo(canvas: HTMLCanvasElement, delay: number) {
    this.canvas = canvas;

    // this.clientWidth = Number.parseInt(this.canvas.getAttribute('width'));
    // this.clientHeight = Number.parseInt(this.canvas.getAttribute('height'));

    this.delay = delay;
    this.start();
  }

  private start() {
    if (this.frame) {
      return;
    }

    const animate = () => {
      this.frame = requestAnimationFrame(() => {
        // if(this.options.nonRealtimeData){
        //    var dateZero = new Date(0);
        //    // find the data point with the latest timestamp
        //    var maxTimeStamp = this.seriesSet.reduce(function(max, series){
        //      var dataSet = series.timeSeries.data;
        //      var indexToCheck = Math.round(this.options.displayDataFromPercentile * dataSet.length) - 1;
        //      indexToCheck = indexToCheck >= 0 ? indexToCheck : 0;
        //      indexToCheck = indexToCheck <= dataSet.length -1 ? indexToCheck : dataSet.length -1;
        //      if(dataSet && dataSet.length > 0)
        //      {
        //       // timestamp corresponds to element 0 of the data point
        //       var lastDataTimeStamp = dataSet[indexToCheck][0];
        //       max = max > lastDataTimeStamp ? max : lastDataTimeStamp;
        //      }
        //      return max;
        //   }.bind(this), dateZero);
        //   // use the max timestamp as current time
        //   this.render(this.canvas, maxTimeStamp > dateZero ? maxTimeStamp : null);
        // } else {
          this.render();
        // }
        animate();
      })
    }

    animate();
  }

  private render() {
    const now = Date.now();
    // 帧率限制
    if (this.frameTime > 0 && now - this.lastRenderTime < this.frameTime) return;

    console.log('render', this.frameTime);

    this.lastRenderTime = now;
  }
}
