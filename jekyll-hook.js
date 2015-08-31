#!/usr/bin/env node

var config  = require('./config.json');
var fs      = require('fs');
var express = require('express');
var app     = express();
var queue   = require('queue-async');
var tasks   = queue(1);
var spawn   = require('child_process').spawn;
var email   = require('emailjs/email');
var mailer  = email.server.connect(config.email);
var crypto  = require('crypto');

//////////////////////////////////
//////////////////////////////////

app.use(express.bodyParser({
    verify: function(req,res,buffer){
        if(!req.headers['x-hub-signature']){
            return;
        }

        if(!config.secret || config.secret==""){
            console.log("Recieved a X-Hub-Signature header, but cannot validate as no secret is configured");
            return;
        }

        var hmac         = crypto.createHmac('sha1', config.secret);
        var recieved_sig = req.headers['x-hub-signature'].split('=')[1];
        var computed_sig = hmac.update(buffer).digest('hex');

        if(recieved_sig != computed_sig){
            console.warn('Recieved an invalid HMAC: calculated:' + computed_sig + ' != recieved:' + recieved_sig);
            var err = new Error('Invalid Signature');
            err.status = 403;
            throw err;
        }
    }

}));

// Receive webhook post for Jekyll website with gh-pages branch
app.post('/hooks/jekyll/*', function(req, res) {
    // Close connection
    res.send(202);

    // Queue request handler
    tasks.defer(function(req, res, cb) {
        var data = req.body;
        var branch = req.params[0];
        var params = [];

        // Parse webhook data for internal variables
        data.repo = data.repository.name;
        if (! data.ref) {
            console.log('You just set up a webhook on Github, it\'s a test event but not a push event.\nExit to wait real push event.');
            if (typeof cb === 'function') cb();
            return;
        }
        data.branch = data.ref.replace('refs/heads/', '');
        data.owner = data.repository.owner.name;

        // End early if not permitted account
        if (config.accounts.indexOf(data.owner) === -1) {
            console.log(data.owner + ' is not an authorized account.');
            if (typeof cb === 'function') cb();
            return;
        }

        // End early if not permitted branch
        if (data.branch !== branch) {
            console.log('Not ' + branch + ' branch.');
            if (typeof cb === 'function') cb();
            return;
        }

        // Process webhook data into params for scripts
        /* repo   */ params.push(data.repo);
        /* branch */ params.push(data.branch);
        /* owner  */ params.push(data.owner);

        /* giturl */
        params.push('ssh://git@' + config.gh_server + '/' + data.owner + '/' + data.repo + '.git');

        /* source */ params.push(config.temp + '/' + data.owner + '/' + data.repo + '/' + data.branch + '/' + 'code');
        /* build  */ params.push(config.temp + '/' + data.owner + '/' + data.repo + '/' + data.branch + '/' + 'site');

        // Script by branch.
        var build_script = null;
        try {
          build_script = config.scripts[data.branch].build;
        }
        catch(err) {
          try {
            build_script = config.scripts['#default'].build;
          }
          catch(err) {
            throw new Error('No default build script defined.');
          }
        }

        var publish_script = null;
        try {
          publish_script = config.scripts[data.branch].publish;
        }
        catch(err) {
          try {
            publish_script = config.scripts['#default'].publish;
          }
          catch(err) {
            throw new Error('No default publish script defined.');
          }
        }

        // Run build script
        run(build_script, params, function(err) {
            if (err) {
                console.log('Failed to build: ' + data.owner + '/' + data.repo);
                send('Your website at ' + data.owner + '/' + data.repo + ' failed to build.', 'Error building site', data);

                if (typeof cb === 'function') cb();
                return;
            }

            // Run publish script
            run(publish_script, params, function(err) {
                if (err) {
                    console.log('Failed to publish: ' + data.owner + '/' + data.repo);
                    send('Your website at ' + data.owner + '/' + data.repo + ' failed to publish.', 'Error publishing site', data);

                    if (typeof cb === 'function') cb();
                    return;
                }

                // Done running scripts
                console.log('Successfully rendered: ' + data.owner + '/' + data.repo);
                send('Your website at ' + data.owner + '/' + data.repo + ' was successfully published.', 'Successfully published site', data);

                if (typeof cb === 'function') cb();
                return;
            });
        });
    }, req, res);

});

// Receive webhook post for Jekyll webiste without gh-pages branch
app.post('/hooks/jekyll_no_ghpages/*', function(req, res) {
    // Close connection
    res.send(202);

    // Queue request handler
    tasks.defer(function(req, res, cb) {
        var data = req.body;
        var branch = req.params[0];
        var params = [];

        // Parse webhook data for internal variables
        data.repo = data.repository.name;
        if (! data.ref) {
            console.log('You just set up a webhook on Github, it\'s a test event but not a push event.\nExit to wait real push event.');
            if (typeof cb === 'function') cb();
            return;
        }
        data.branch = data.ref.replace('refs/heads/', '');
        data.owner = data.repository.owner.name;

        // End early if not permitted account
        if (config.accounts.indexOf(data.owner) === -1) {
            console.log(data.owner + ' is not an authorized account.');
            if (typeof cb === 'function') cb();
            return;
        }

        // End early if not permitted branch
        if (data.branch !== branch) {
            console.log('Not ' + branch + ' branch.');
            if (typeof cb === 'function') cb();
            return;
        }

        // Process webhook data into params for scripts
        /* repo   */ params.push(data.repo);
        /* branch */ params.push(data.branch);
        /* owner  */ params.push(data.owner);

        /* giturl */
        params.push('ssh://git@' + config.gh_server + '/' + data.owner + '/' + data.repo + '.git');

        /* source */ params.push(config.temp + '/' + data.owner + '/' + data.repo + '/' + data.branch + '/' + 'code');
        /* build  */ params.push(config.temp + '/' + data.owner + '/' + data.repo + '/' + data.branch + '/' + 'site');

        // Script by branch.
        var build_script = null;
        try {
          build_script = config.scripts[data.branch].build;
        }
        catch(err) {
          try {
            build_script = config.scripts['#default'].build;
          }
          catch(err) {
            throw new Error('No default build script defined.');
          }
        }

        var publish_script = null;
        try {
          publish_script = config.scripts[data.branch].publish_no_ghpages;
        }
        catch(err) {
          try {
            publish_script = config.scripts['#default'].publish_no_ghpages;
          }
          catch(err) {
            throw new Error('No default publish script defined.');
          }
        }

        // Run build script
        run(build_script, params, function(err) {
            if (err) {
                console.log('Failed to build: ' + data.owner + '/' + data.repo);
                send('Your website at ' + data.owner + '/' + data.repo + ' failed to build.', 'Error building site', data);

                if (typeof cb === 'function') cb();
                return;
            }

            // Run publish script
            run(publish_script, params, function(err) {
                if (err) {
                    console.log('Failed to publish: ' + data.owner + '/' + data.repo);
                    send('Your website at ' + data.owner + '/' + data.repo + ' failed to publish.', 'Error publishing site', data);

                    if (typeof cb === 'function') cb();
                    return;
                }

                // Done running scripts
                console.log('Successfully rendered: ' + data.owner + '/' + data.repo);
                send('Your website at ' + data.owner + '/' + data.repo + ' was successfully published.', 'Successfully published site', data);

                if (typeof cb === 'function') cb();
                return;
            });
        });
    }, req, res);

});

// Receive webhook post for doxygen
app.post('/hooks/doxygen/', function(req, res) {
    // Close connection
    res.send(202);

    // Queue request handler
    tasks.defer(function(req, res, cb) {
        var data = req.body;
        //var branch = req.params[0]; More info ---> http://expressjs.com/4x/api.html#req.params
        var params = []; // create an empty stack

        // Parse webhook data for internal variables
        data.repo = data.repository.name;
        if (! data.ref) {
            console.log('You just set up a webhook on Github, it\'s a test event but not a push event.\nExit to wait real push event.');
            if (typeof cb === 'function') cb();
            return;
        }
        data.branch = data.ref.replace('refs/heads/', '');
        data.owner = data.repository.owner.name;

        // End early if not permitted account
        if (config.accounts.indexOf(data.owner) === -1) {
            console.log(data.owner + ' is not an authorized account.');
            if (typeof cb === 'function') cb();
            return;
        }

        // End early if not permitted branch
        //if (data.branch !== branch) {
        //    console.log('Not ' + branch + ' branch.');
        //    if (typeof cb === 'function') cb();
        //    return;
        //}

        if (data.branch !== config.doc_branch_master && data.branch !== config.doc_branch_develop) {
          console.log('Not match any branch defined in config.json file. Ignore commit.' );
          if (typeof cb === 'function') cb();
          return;
        }

        // Process webhook data into params for scripts
        /* repo   */ params.push(data.repo);
        /* branch */ params.push(data.branch);
        /* owner  */ params.push(data.owner);

        /* giturl */
        params.push('ssh://git@' + config.gh_server + '/' + data.owner + '/' + data.repo + '.git');

        /* source */ params.push(config.temp + '/' + data.owner + '/' + data.repo + '/' + data.branch + '/' + 'code');
        /* build  */ params.push(config.temp + '/' + data.owner + '/' + data.repo + '/' + data.branch + '/' + 'site');

        // Script by branch.
        var build_script = null;
        try {
          build_script = config.scripts[data.branch].buildDoc;
        }
        catch(err) {
          try {
            build_script = config.scripts['#default'].buildDoc;
          }
          catch(err) {
            throw new Error('No default build script defined.');
          }
        }

        var publish_script = null;
        try {
          publish_script = config.scripts[data.branch].publishDoc;
        }
        catch(err) {
          try {
            publish_script = config.scripts['#default'].publishDoc;
          }
          catch(err) {
            throw new Error('No default publish script defined.');
          }
        }

        // Run build script
        run(build_script, params, function(err) {
            if (err) {
                console.log('Failed to build: ' + data.owner + '/' + data.repo);
                send('Your website at ' + data.owner + '/' + data.repo + ' failed to build.', 'Error building site', data);

                if (typeof cb === 'function') cb();
                return;
            }

            // Run publish script
            run(publish_script, params, function(err) {
                if (err) {
                    console.log('Failed to publish: ' + data.owner + '/' + data.repo);
                    send('Your website at ' + data.owner + '/' + data.repo + ' failed to publish.', 'Error publishing site', data);

                    if (typeof cb === 'function') cb();
                    return;
                }

                // Done running scripts
                console.log('Successfully rendered: ' + data.owner + '/' + data.repo);
                send('Your website at ' + data.owner + '/' + data.repo + ' was successfully published.', 'Successfully published site', data);

                if (typeof cb === 'function') cb();
                return;
            });
        });
    }, req, res);

});

// Receive news webhook 
app.post('/hooks/news/*', function(req, res) {
    // Close connection
    res.send(202);

    // Queue request handler
    tasks.defer(function(req, res, cb) {
        var data = req.body;
        var branch = req.params[0];
        var params = [];

        // Parse webhook data for internal variables
        data.repo = data.repository.name;
        if (! data.ref) {
            console.log('You just set up a webhook on Github, it\'s a test event but not a push event.\nExit to wait real push event.');
            if (typeof cb === 'function') cb();
            return;
        }
        data.branch = data.ref.replace('refs/heads/', '');
        data.owner = data.repository.owner.name;

        // End early if not permitted account
        if (config.accounts.indexOf(data.owner) === -1) {
            console.log(data.owner + ' is not an authorized account.');
            if (typeof cb === 'function') cb();
            return;
        }

        // End early if not permitted branch
        if (data.branch !== branch) {
            console.log('Not ' + branch + ' branch.');
            if (typeof cb === 'function') cb();
            return;
        }

        // Process webhook data into params for scripts
        /* repo   */ params.push(data.repo);
        /* branch */ params.push(data.branch);
        /* owner  */ params.push(data.owner);

        /* giturl */
        params.push('ssh://git@' + config.gh_server + '/' + data.owner + '/' + data.repo + '.git');


        /* source */ params.push(config.temp + '/' + data.owner + '/' + 'news' + '/' + 'websites');

        // Script by branch.
        var build_script = null;
        try {
          build_script = config.scripts[data.branch].pullNews;
        }
        catch(err) {
          try {
            build_script = config.scripts['#default'].pullNews;
          }
          catch(err) {
            throw new Error('No default pull script defined.');
          }
        }

        // Run pull script
        run(build_script, params, function(err) {
            if (err) {
                console.log('Failed to pull: ' + data.owner + '/' + data.repo);
                send('Your website at ' + data.owner + '/' + data.repo + ' failed to build.', 'Error building site', data);

                if (typeof cb === 'function') cb();
                return;
            }

            // Done running scripts
            console.log('Successfully synchronize news subtree: ' + data.owner + '/' + data.repo);
            send('The three websites repos are synchronized with news.');

            if (typeof cb === 'function') cb();
            return;
        });
    }, req, res);

});

// Start server
var port = process.env.PORT || 8080;
app.listen(port);
console.log('Listening on port ' + port);

function run(file, params, cb) {

    var process = spawn(file, params);
    

    process.stdout.on('data', function (data) {
        console.log('' + data);
    });

    process.stderr.on('data', function (data) {
        console.warn('' + data);
    });

    process.on('exit', function (code) {
        if (typeof cb === 'function') cb(code !== 0);
    });
}

function send(body, subject, data) {
    if (config.email && config.email.isActivated && data.pusher.email) {
        var message = {
            text: body,
            from: config.email.user,
            to: data.pusher.email,
            subject: subject
        };
        mailer.send(message, function(err) { if (err) console.warn(err); });
    }
}
