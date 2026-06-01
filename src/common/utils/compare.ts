// Compara objetos para el update
// 
export function isEqueals (objOrigin: Object,objCompare: Object) {
    return Object.keys(objCompare).every((key) => 
        objOrigin[key] ===objCompare[key]
    )
}