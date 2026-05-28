// Compara objetos para el update
export function isEqueals (obj1: Object, obj2: Object) {
    return Object.keys(obj2).every((key) => 
        obj1[key] === obj2[key]
    )
}