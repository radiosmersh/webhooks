#!/bin/bash
set -e

# This script is meant to be run automatically
# as part of the jekyll-hook application.
# https://github.com/developmentseed/jekyll-hook

repo=$1
branch=$2
owner=$3
giturl=$4
source=$5
build=$6

# Deploy gh-pages branch
cd $source
git fetch $giturl gh-pages:gh-pages
git checkout gh-pages
git pull origin gh-pages
git rm -qr .
cp -r $build/. .
git add -A
git commit -m "gh-pages update"
git push origin gh-pages
cd - 

# Set the path of the hosted site
site="/var/www/$repo"

if [ ! -d $site ]; then
    mkdir -p $site
fi

rsync -az $build $site
# Remove old site files, move new ones in place
# On amazon EC2 use sudo if nginx html forlder has root ownership

#rm -rf $site
#mv $build $site
