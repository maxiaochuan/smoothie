export default class Util {
  public static pixelSnap(position: number, lineWidth: number) {
    return lineWidth % 2 === 0 ? Math.round(position) : Math.floor(position) + 0.5;
  }
}
