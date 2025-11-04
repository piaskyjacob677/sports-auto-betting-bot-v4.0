module.exports = (fn) => {
    return (req, res, next) => {
        return fn(req, res, next).catch((err) => {
            console.log(err);
            if (typeof err === "string" && err.length < 100) res.status(400).send(err);
            else res.status(500).send("Error occured!");
        });
    };
}