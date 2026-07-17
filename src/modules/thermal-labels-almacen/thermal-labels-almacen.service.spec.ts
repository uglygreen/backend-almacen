import { ThermalLabelsAlmacenService } from './thermal-labels-almacen.service';

describe('ThermalLabelsAlmacenService', () => {
  let service: ThermalLabelsAlmacenService;

  beforeEach(() => {
    service = new ThermalLabelsAlmacenService();
  });

  it('expande etiquetas con ^PQ y las deja con ^PQ1', () => {
    const zpl = '^XA^FO50,50^FDVALVULA^FS^PQ3^XZ';

    const expandido = (service as any).expandirCantidadesZPL(zpl);
    const bloques = expandido.match(/\^XA[\s\S]*?\^XZ/g) ?? [];

    expect(bloques).toHaveLength(3);
    expect(expandido.match(/\^PQ1/g)).toHaveLength(3);
    expect(expandido).not.toContain('^PQ3');
  });

  it('conserva bloques sin ^PQ', () => {
    const zpl = '^XA^FO20,20^FDUNO^FS^XZ^XA^FO30,30^FDDOS^FS^XZ';

    const expandido = (service as any).expandirCantidadesZPL(zpl);
    const bloques = expandido.match(/\^XA[\s\S]*?\^XZ/g) ?? [];

    expect(bloques).toHaveLength(2);
    expect(expandido).toBe(zpl);
  });
});
