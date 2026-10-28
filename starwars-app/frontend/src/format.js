export const GENEROS = {
  male: 'Masculino',
  female: 'Femenino',
  'n/a': 'No aplica',
  hermaphrodite: 'Hermafrodita',
  none: 'Ninguno',
};

export const ICONO_GENERO = { male: '♂', female: '♀', hermaphrodite: '⚥' };

const COLORES = {
  blue: 'azul', brown: 'café', black: 'negro', blond: 'rubio', yellow: 'amarillo',
  red: 'rojo', white: 'blanco', grey: 'gris', gray: 'gris', orange: 'naranja',
  hazel: 'avellana', green: 'verde', pink: 'rosa', auburn: 'castaño rojizo',
  gold: 'dorado', fair: 'clara', light: 'clara', dark: 'oscura', pale: 'pálida',
  silver: 'plateado', tan: 'bronceada', metal: 'metal', unknown: 'desconocido',
};

export const genero = (g) => GENEROS[g] || g;

export const color = (v) => {
  if (!v) return 'Desconocido';
  const t = v.split(/\s*,\s*/).map((c) => c.split(/[\s-]+/).map((w) => COLORES[w] || w).join(' ')).join(', ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const iniciales = (nombre) =>
  nombre.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

export const fmt = new Intl.NumberFormat('es-MX');
