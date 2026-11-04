/**
 * Máximo de registros que carga un listado operativo (en páginas de 1,000 con
 * fetchRows). Los indicadores de la pantalla se calculan con esos registros, así
 * que el límite debe cubrir un periodo normal completo; si se alcanza, la tabla
 * lo avisa (TablePagination) para que se acote el periodo.
 */
export const LIST_LIMIT = 5000
