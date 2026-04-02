/**
 * Decodifica un valor individual de aceleración (base64 → int16 → m/s²)
 */
export function decodeAcceleration(encoded: string): number {
  const acc = encoded + '=';
  const decodedBytes = Buffer.from(acc, 'base64');

  if (decodedBytes.length !== 2) {
    console.error('Invalid acceleration encoding', { encoded });
    return NaN;
  }

  const decodedInt = decodedBytes.readInt16BE(0);

  const value = (decodedInt * 9.8) / 1000;
  return Math.round(value * 10000) / 10000;
}

/**
 * Decodifica un array de strings tipo:
 * ["x:...", "y:...", "z:..."]
 */
export function decodeAccelerations(accelerations: string[]): {
  decoded_x: number[];
  decoded_y: number[];
  decoded_z: number[];
} {
  let xStr: string | undefined;
  let yStr: string | undefined;
  let zStr: string | undefined;

  accelerations.forEach((accStr) => {
    const identifier = accStr.slice(0, 2);
    const rest = accStr.slice(2);

    if (identifier === 'x:') xStr = rest;
    else if (identifier === 'y:') yStr = rest;
    else if (identifier === 'z:') zStr = rest;
  });

  if (!xStr || !yStr || !zStr) {
    throw new Error('Missing x, y or z acceleration data');
  }

  const decoded_x: number[] = [];
  const decoded_y: number[] = [];
  const decoded_z: number[] = [];

  for (let i = 0; i < xStr.length; i += 3) {
    const x = decodeAcceleration(xStr.slice(i, i + 3));
    const y = decodeAcceleration(yStr.slice(i, i + 3));
    const z = decodeAcceleration(zStr.slice(i, i + 3));

    // si alguno es NaN ignoramos el sample
    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
      console.warn('[ACC_SAMPLE_SKIPPED]', { index: i / 3 });
      continue;
    }

    decoded_x.push(x);
    decoded_y.push(y);
    decoded_z.push(z);
  }

  return { decoded_x, decoded_y, decoded_z };
}
