# Setup Webhooks As A Upstart Service With Node.js And Bash Scripts

## Introduction

For more information, see the following report: [link](https://solael.gitbooks.io/internship-report/content/index.html)

## Installation

### Install apt packages
```bash
sudo apt-get update
sudo apt-get install git nodejs ruby ruby1.9.1-dev npm
```
Symlink nodejs to node, this is a known issue in Ubuntu.

```bash
sudo ln -s /usr/bin/nodejs /usr/bin/node
```

## Install npm packages and gems

To avoid path issues, install packages globally.

```bash
sudo npm install -g fs
sudo npm install -g express
sudo npm install -g queue-async
sudo npm install -g emailjs
sudo npm install -g crypto
sudo npm install -g console-ten
```
We also need Jekyll and Nginx

```bash
sudo gem install jekyll rdiscount json
sudo apt-get install nginx
```

## User creation and user configuration

Create a user called `feelpp-web` and add this user to group `www-data`, which is a group special for Nginx web server.

```bash
sudo adduser feelpp-web
sudo adduser feelpp-web sudo # this is optional, you can also use another sudoer user and install all necessary packages/npm/gems
sudo usermod -a -G www-data feelpp-web #Add a user to a group
```
We also need to change its default group from `feelpp-web` to `www-data`.
To assign a primary group to an user:

```bash
$ usermod -g primarygroupname username
```

Then login with user `feelpp-web`. Clone Github repository [webhooks](https://github.com/cemosis/webhooks/) into `/home/feelpp-web/hooks/`. And do a `npm install` in `/home/feelpp-web/hooks/`.

Transfer ownership of directory `/var/www/` to user `feelpp-web` and give him full permissions.
```bash
sudo chown -R feelpp-web:www-data /var/www/
sudo chmod u+rwx /var/www/
````

## Configuration

### config.json configurations

Note: the following texts after `##` are explanations, they are not in the real json file(and we shouldn't do that). 

```json
{
    "gh_server": "github.com",
    "temp": "/home/feelpp-web", ## where we pull repositories and generate static files. Don't use a `tmp/` because tmp/ will be cleared at every reboot.
    "doc_branch_master": "master", ## "Hard coded" variable, check if the received webhook from feelpp repo contains a commit on master branch
    "doc_branch_develop": "develop", ## check if the received webhook from feelpp repo contains a commit on develop branch
    "public_repo": true,
    "scripts": {
      "#default": {
        "build": "./scripts/jekyll/build.sh", ## build script for generic jekyll repo, only build website into /tmp/$repo/site
        "publish": "./scripts/csmi.math.unistra.fr/publish.sh", ## move website from /tmp/$repo/site into /var/www/$repo and push changes to gh-pages branch
        "buildDoc": "./scripts/feelpp-doxygen/buildDoc.sh", ## build docs for feelpp with cmake and doxygen, rsync generated files into /var/www/doc.feelpp.org/html/$branch (master or develop)
        "publishDoc": "./scripts/feelpp-doxygen/publishDoc.sh", ## not used
        "pullNews": "./scripts/news/pull.sh", ## pull changes form news subtree, push them to cemosis, csmi and feelpp.org under _posts folder
        "publish_no_ghpages": "./scripts/jekyll/publish_no_ghpages.sh" ## build jekyll webiste and move generated files to /var/www/$repo
      }
    },
    "secret": "******",
    "email": {
        "isActivated": false,
        "user": "",
        "password": "",
        "host": "smtp.gmail.com",
        "ssl": true
    },
    "accounts": [
	    "feelpp",
        "cemosis",
        "feelpp-robot"
    ]
}
```

## Github configurations for feelpp-web

Login with user `feelpp-web`.

### setup git push.default

`git config --global push.default simple`

This can pervent git print useless info in log file.

### setup git authentification to avoid account/passwd
```
git config --global user.name "feelpp-robot"
git config --global user.email "feelpp-robot@feelpp.org"
ssh-keygen -t rsa -C "feelpp-robot@feelpp.org"
```
Generate ssh key and copy it to github settings.

And when pull repository use something like:
`git clone ssh://git@github.com/cemosis/csmi.cemosis.fr`

**Do not use https protocol.**

Code snippet in `jekyll-hook.js`

```javascript
/* giturl */
	params.push('ssh://git@' + config.gh_server + '/' + data.owner + '/' + data.repo + '.git');
```

To avoid authentification issues with git pull or git push commands, set ssh connection and don't use `https` protocol.

### Install jekyll plugins

Before all, tell Rubygems not to install the documentation for each package locally
```bash
echo "gem: --no-ri --no-rdoc" > ~/.gemrc
```

Install gems for www.feelpp.org

```bash
sudo gem install jekyll-scholar
```

Put file jekyll-orcid.rb from [jekyll-orcid repository](https://github.com/mfenner/jekyll-orcid) into _plugins folder

Install the Faraday and Faraday middleware gems:

```bash
gem install faraday
gem install faraday_middleware
```
Install Nogoriki

```bash
sudo gem install nokogiri
```

If error occurres while executing gems that are already installed, do a `sudo gem cleanup`.

## Set Up the Virtual Hosts

Open up the new virtual host file
```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/www.cemosis.fr
sudo nano /etc/nginx/sites-available/www.cemosis.fr
```
We need to make a couple of changes in these few lines:
Remove `ipv6only=on` and `default_server` as they can only used once. We'll put them in /etc/nginx/sites-available/csmi.cemosis.fr
```
server {
        listen 80;
        listen [::]:80;

        #root /usr/share/nginx/html/;
        root /var/www/www.cemosis.fr/site; # use path recording to path where static files were generated
        index index.html index.htm;

        # Make site accessible from http://localhost/
        #server_name localhost;
        server_name cemosis.fr www.cemosis.fr;
		...
}
```
```bash
sudo ln -s /etc/nginx/sites-available/www.cemosis.fr /etc/nginx/sites-enabled/www.cemosis.fr
```
Follow the steps above for each webiste(doc.feelpp.org, cemosis.fr, www.feelpp.org, csmi.math.unistra.fr...)
```
Note: for doc.feelpp.org, set `/var/www/doc.feelpp.org/html/`as root in Nginx's settings. The index page of doc.feelpp.org should be generated into this folder by doxygen and webhooks will automatically build `master/` folder and `develop/` folder into it.
```
Then delete the default enabled website setting.

```bash
sudo rm /etc/nginx/sites-enabled/default
```

### setup updstart service

```
sudo npm install -g upstarter
sudo upstarter
Upstart service name (jekyll-hook): webhook
Command(s) to run: (hit enter twice when done)
cd /home/feelpp-web/hooks
/home/feelpp-web/hooks/jekyll-hook.js >> /home/feelpp-web/log/webhook.log 2>&1

Upstart service description (A server that listens for GitHub webhook posts and renders a Jekyll site): 
Log output to /var/log/upstart? (y/n): y
System user to run under (root): feelpp-web
Set max file descriptors (1000000): 
Working directory for process (/home/feelpp-web/hooks): 
Respawn automatically? (y/n): y
 # webhook.conf

description "A server that listens for GitHub webhook posts and renders a Jekyll site"

start on started networking
stop on runlevel [016]

setuid feelpp-web


limit nofile 1000000 1000000


console log

script

  cd /home/feelpp-web/hooks
/home/feelpp-web/hooks/jekyll-hook.js &gt;&gt; /home/feelpp-web/log/webhook.log 2&gt;&amp;1
end script

respawn

 
about to write this to /etc/init/webhook.conf. is this ok? (y/n) y
wrote /etc/init/webhook.conf
```

Now open webhook.conf and do some tweaks:

```
# webhook.conf

description "A server that listens for GitHub webhooks and renders websites"

start on started networking
stop on runlevel [016]

setuid feelpp-web
setgid www-data

limit nofile 1000000 1000000


console log

script
  export HOME="/home/feelpp-web/"
  cd $HOME/hooks
  $HOME/hooks/jekyll-hook.js >> $HOME/log/webhook.log 2>&1
end script

respawn

```

Start the service with: `sudo service webhook start`

Check log file firstly in /home/feelpp-web/log/webhook.log then in /var/log/upstart/webhook.log to ensure everything works.

###Setup webhooks for websites
#### csmi.math.unistra.fr and csmi.cemosis.fr
In Github repository settings, go to Webhooks & services and click Add webhook button.
```
Payload URL: http://csmi.math.unitra.fr:8080/hooks/jekyll/master
Content type:
application/json
Secret:
******
Which events would you like to trigger this webhook?
Just the `push` event.
- [x] Active
```
#### www.cemosis.fr and www.feelpp.org
```
Payload URL: http://csmi.math.unitra.fr:8080/hooks/jekyll_no_ghpages/master
Content type:
application/json
Secret:
******
Which events would you like to trigger this webhook?
Just the `push` event.
- [x] Active
```
#### doc.feelpp.org
```
Payload URL: http://csmi.math.unitra.fr:8080/hooks/doxygen/
Content type:
application/json
Secret:
******
Which events would you like to trigger this webhook?
Just the `push` event.
- [x] Active
```
### Trouble shooting

Check webhook upstart service status:

```bash
status webhook
```

Start/stop/restart webhook service
```bash
sudo start webhook
sudo stop webhook
sudo restart webhook
```

Example:
```bash
sudo start webhook 
webhook start/running, process 2486
```


### Serious errors crash the nodejs server
```javascript
events.js:72
        throw er; // Unhandled 'error' event
              ^
Error: spawn EACCES
    at errnoException (child_process.js:988:11)
    at Process.ChildProcess._handle.onexit (child_process.js:779:34)
```
The script have no permission to do something, this often occures when the script is trying to modify file/directory that `feelpp-web` doesn't have permission to write.
Be careful if you are going to create new sh scripts, make sure that you give `rwx` permissions to scripts that you write.

```javascript
events.js:72
        throw er; // Unhandled 'error' event
              ^
Error: listen EADDRINUSE
```
The port 8080 is already in use, make sure that no other programs are using that port and don't execute 2 instances of `jekyll-hook.js` at the same time.
