// CSS named colors, excluding CSS-wide keywords. Keep shadow values valid when
// changing a live style: browsers ignore invalid assignments and retain old paint.
const NAMED_COLORS = new Set(`aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent currentcolor`.split(' '));

/** Supported self-contained CSS colors. Variables, functions such as calc(),
 * and system/CSS-wide keywords intentionally do not belong to saved shadows. */
export function isShadowColor(value: string): boolean {
  const text = value.trim().toLowerCase();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(text) || NAMED_COLORS.has(text)) return true;
  const match = /^(rgba?|hsla?)\(([^()]*)\)$/.exec(text);
  if (!match) return false;
  const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  const scalar = (raw: string, percent = true) => {
    const token = percent && raw.endsWith('%') ? raw.slice(0, -1) : raw;
    return number.test(token) && Number.isFinite(Number(token));
  };
  const body = match[2].trim(), comma = body.includes(',');
  let channels: string[], alpha: string | undefined;
  if (comma) {
    if (body.includes('/')) return false;
    const parts = body.split(',').map(part => part.trim());
    if (parts.length !== 3 && parts.length !== 4) return false;
    channels = parts.slice(0, 3); alpha = parts[3];
  } else {
    const parts = body.split('/');
    if (parts.length > 2) return false;
    channels = parts[0].trim().split(/\s+/); alpha = parts[1]?.trim();
  }
  if (channels.length !== 3 || alpha !== undefined && !scalar(alpha)) return false;
  if (match[1].startsWith('rgb')) {
    if (!channels.every(token => scalar(token))) return false;
    // Legacy comma RGB requires three numbers or three percentages.
    return !comma || channels.every(token => token.endsWith('%') === channels[0].endsWith('%'));
  }
  const hue = channels[0].replace(/(?:deg|grad|rad|turn)$/, '');
  return scalar(hue, false) && channels.slice(1).every(token => token.endsWith('%') && scalar(token));
}
