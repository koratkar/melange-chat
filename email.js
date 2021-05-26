let nodemailer = require('nodemailer')
var transporter = nodemailer.createTransport({
    host: '',
    port: 465,
    secure: true,
    auth: {
        user: '',
        pass: ''
    }
})

exports.send_email = function (email_addr, link, subject) {
   transporter.sendMail({
       from: "",
       to: email_addr,
       subject: subject, 
       text: link
   }, (err, res) => {
        if (err) {console.log(err)} else {
            return
        }
   })
}
