//eslint: esversion: 8, asi: true
let express = require('express');
let ejs = require('ejs')
let { Client } = require('pg')
let session = require('cookie-session');
let schedule = require('node-schedule')

let mailer = require('./email.js')
let onetime = require ('./onetime.js')
let client = new Client({
    host: 'localhost',
    user: 'ishaan',
    password: 'break notions, make things',
    port: '5432',
    database: 'spicedb'
})
client.connect()

let app = express()
app.set('view engine', ejs)
app.use(express.urlencoded({
    extended: true
}))
app.use(express.static('public'))
app.set('trust proxy', 1)
app.use(session({ 
    secret: 'and awaaaay we go! and that_s the waaaaay the news goes! god help me.', 
    cookie: { maxAge: 210 * 24 * 60 * 60 * 1000, expires: true},
    resave: false, 
    saveUninitialized: true,
    name: 'horselemonspikecheese',
    secure: false},))

var places_store = {
    music: {
        title:"music",
        description:"a place for emergent singing.",
        chat: ["sys> here comes the sun"]
    },
    startrek: {
        title:"startrek",
        description:"Space: the final frontier...",
        chat: ["sys> To boldy go where no one has gone before!"]
    },
    programming: {
        title:"programming",
        description:"y(f) = f(y(f))",
        chat: ["sys> nano is the best text editor hands down."]
    },
    phish: {
        title:"phish",
        description:"not just high college kids",
        chat: ["sys> Garry Kasparov totally coached 1995 audience v. phish game."]
    },
    dune: {
        title:"dune",
        description:"Wheels within wheels",
        chat: ["sys> It was mostly sweet"]
    },
    main: {
        title:"main",
        description:"Spice, heresy, and good friends.",
        chat: [""]
    },
}

var new_user_links = {}
var old_user_links = {}
schedule.scheduleJob('0 0 0 * * *', () => {
    new_user_links = {}
    old_user_links = {}
    message_count = 0
})

var message_count = 0

function is_blank(str) {
    return (!str || /^\s*$/.test(str))
}

async function auth_user(uname, cake) {
    if (uname == undefined) {
        return false
    }
    let query = {
        text: 'SELECT cake_day FROM fremen WHERE uname = $1',
        values: [uname]
    }
    let cake_n
    let res = await client.query(query)                
    if (res.rows[0].cake_day == cake) {
        return true
    }
}

app.get('/', (req, res) => {
    let name = req.session.uname
    let cake = req.session.cake_day
    if (cake > 0) {
        auth_user(name, req.session.cake_day).then((resp) => {
            if (resp == true) {
                res.redirect('/p/main')
            } else {
                res.render('error.ejs', {title: "Authentication error", prob: "go <a href='/logout'>here</a> to fix the authentication error."})
            }
        }).catch(err => {
            console.log(err)
        })
    } else {
        res.redirect('/signup')
    }
})

app.post('/log/:make', (req, res) => {
    let email = req.body.email.trim().toLowerCase()
    if (req.params.make == 'log') {
        client.query("SELECT cake_day FROM fremen WHERE email = $1", [email], (err, resp) => {
            if (err) {
                console.log(err.stack)
                res.render("error.ejs", {title: "login error", prob:"you may have set your username too long or used illegal characters."})
            } else {
                if (resp.rows.length == 0) {
                    res.render("error.ejs", {title: "error", prob: "That email wasn't found"})
                } else {
                    let code = onetime.gen(email)
                    old_user_links[(code.toString())] = email
                    let special_link = "https://spice.koratkar.com/oldser/" + code
                    mailer.send_email(email, special_link, "Melange Chat Log In Link")
                    res.redirect("/email-sent")
                }
            }
        })
    } else if (req.params.make == 'make') {
        client.query('SELECT cake_day FROM fremen WHERE email = $1', [email], (err, resp) => {
            if (err) {console.log(err.stack)} else {
                if (resp.rows.length == 0) {
                    let code = onetime.gen(email)
                    new_user_links[(code.toString())] = email
                    let special_link = "https://spice.koratkar.com/newser/" + code
                    mailer.send_email(email, special_link, "Melange Chat Activation Link")
                    res.redirect("/email-sent")
                } else {
                    res.render("error.ejs", {title: "error", prob: "That email already exists"})
                }
            }
        })
        
    } else {
        res.render('404.ejs')
    }
})

app.get('/email-sent', (req, res) => {
    res.render('email-sent.ejs', {title: "check your email"})
})

app.get('/newser/:code', (req, res) => {
    let code = req.params.code.toString()
    if (Object.keys(new_user_links).includes(code)) {
        res.render("newser.ejs", {title: "new user signup", code: req.params.code})
    } else {
        res.render("error.ejs", {title: 'code not found', prob: "Access links are deleted at the end of each day or when used."})
    }
})

async function new_user(case_uname, case_addr, cake) {
    let uname = case_uname.toLowerCase()
    let addr = case_addr.toLowerCase()
    let regex = /[^a-z|A-Z|_|0-9|λ|-]/
    if (uname.match(regex) == null) {
        if (uname.length > 3 && uname.length < 15) {
            let res = await client.query('INSERT INTO fremen(uname, email, cake_day) VALUES($1, $2, $3) RETURNING *', [uname, addr, cake])
            if (res.command == 'INSERT') {
                return true
            } else {
                return "Lo siento, señor/a. Your username may be taken, or something else went wrong. Try again." 
            }
        }
    } else {
         return "Lo siento: There were wacky characters in your name. Go back to continue."
    }
}

app.post('/newser/:code', (req, res) => {
    if (Object.keys(new_user_links).includes(req.params.code)) {
        let uname = req.body.uname
        let addr = new_user_links[req.params.code]
        let cake = Date.now()
        new_user(uname, addr, cake).then((resp) => {
            if (resp == true) {
                req.session.cake_day = cake
                req.session.uname = uname.toLowerCase()
                delete new_user_links[req.params.code]
                res.redirect('/')
            } else {
                res.render("error.ejs", {title: "signup error", prob: resp})
            }
        }).catch((err) => {
            console.log(err)
        })
    } else {
        res.render("error.ejs", {title: 'code not found', prob: "Access links are deleted at the end of each day or when used."})
    }
})

app.get('/oldser/:code', (req, res) => {
    if (Object.keys(old_user_links).includes(req.params.code)) {
        let addr = old_user_links[req.params.code]
        client.query("SELECT cake_day, uname FROM fremen WHERE email = $1", [addr], (err, resp) => {
            if (err) {
                console.log(err)
            } else {
                if (resp.rows.length == 0) {
                    res.render("error.ejs", {title: "error", prob: "there was a problem signing you in"})
                } else {
                    req.session.cake_day = resp.rows[0].cake_day
                    req.session.uname = resp.rows[0].uname
                    delete old_user_links[req.params.code]
                    res.redirect("/")
                }
            }
        })
    } else {
        res.render("error.ejs", {title: 'code not found', prob: "Access links are deleted at the end of each day or when used."})
    }
})

app.get('/signup', (req, res) => {
    if (req.session.cake_day > 0) {
        res.redirect('/p/main')
    } else {
        res.render('signup.ejs', {title: "make account"})
    }
})

app.get('/login', (req, res) => {
    if (req.session.loggedIn) {
        res.redirect('/p/main')
    } else {
        res.render('login.ejs', {title: "login"})
    }
})

app.get('/people', (req, res) => {
    console.log(users)
    res.send("people feature coming soon. <a href=\"/\">back home</a>")
})

///////////////////////////////////////

app.get('/places', (req, res) => {
    keys = Object.keys(places_store)
    let list = []
    keys.forEach(element => {
        list.push('<a href=' + '\'' + '/p/' + element + '\'' + '>' + element + '</a>')
    })
    res.render('list-places.ejs', {list: list, title:"Places"})
})

app.get('/p/:place/rend', (req, res) => {
    if (!places_store.hasOwnProperty(req.params.place)) {
        res.send("That place doesn't exist")
    }
    p = req.params.place
    res.render('chat.ejs', {place:places_store[p].chat})
})

app.get('/p/:place/raw', (req, res) => {
    if (!places_store.hasOwnProperty(req.params.place)) {
        res.send("That place doesn't exist")
    }
    p = req.params.place
    res.send({place:places_store[p].chat})
})

app.post('/p/:place/say', (req, res) => {
    let user = req.query.user.toLowerCase().trim()
    if (!places_store.hasOwnProperty(req.params.place)) {
        res.send("That place doesn't exist")
    }
    p = req.params.place
    message_count++
    if (String(req.query.text).length > 70) {
        res.send("too long, mate")
    } else {
        auth_user(req.session.uname, req.session.cake_day).then((resp) => {
            if (resp == true) {
                places_store[p].chat.push(req.query.user.trim() + "> " + req.query.text)
                if (places_store[p].chat.length > 20) {
                    places_store[p].chat.shift()
                }
                res.send("success!")
            } else {
                res.send("who are you?")
            }
        }).catch(err => {console.log(err)})
    }
})

app.get('/p/:place', (req, res) => {
    let name = req.session.uname
    let cake = req.session.cake_day
    if (!places_store.hasOwnProperty(req.params.place)) {
        res.send("That place doesn't exist")
    }
    if (cake > 0) {
        auth_user(name, req.session.cake_day).then((resp) => {
            if (resp == true) {
                let dest = req.params.place
                let data = {
                    title: dest,
                    name: req.session.uname,
                    description: places_store[dest].description
                }
                res.render('place.ejs', data)
            } else {
                res.redirect('/signup')
            }
        }).catch(err => {
            console.log(err)
        })
    } else {
        res.redirect('/signup')
    }
})

/////////////////////////////////////

app.get('/stats', (req, res) => {
    client.query("SELECT count(*) FROM fremen;", (err, resp) => {
        if (err) {
            res.send("oh no")
        } else {
            res.send(resp.rows[0].count + " users | " + message_count + " messages today")
        }
    })

})

app.get('/logout', (req, res) => {
    req.session.cake_day = 0
    req.session.uname = false
    res.redirect('/')
})

app.use(function (req, res, next) {
    let data = {
        path: req.path,
        title: '404 not found'
    }
    res.status(404).render('404.ejs', data)
})

app.listen(3030, () => {
    console.log('port 3030')
})
