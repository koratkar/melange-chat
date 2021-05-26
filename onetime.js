exports.gen = (addr) => {
    function hasher(s) {
        return s.split('').map((s) => {
            let chr = s.charCodeAt(0)
            return ((0 << 5)- 0) + chr
        }).join('')
    }
    return Math.floor((Date.now() / Math.random()) / hasher(addr.slice(0, 3)))
}