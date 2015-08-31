#!/bin/bash
set -e

repo=$1
branch=$2
owner=$3
giturl=$4
source=$5

# Check to see if repo exists. If not, git clone it
if [ ! -d $source/csmi.cemosis.fr ]; then
    git clone ssh://git@github.com/cemosis/csmi.cemosis.fr.git $source/csmi.cemosis.fr
fi

cd $source/csmi.cemosis.fr

git pull origin master

git subtree pull --prefix=_posts $giturl master --squash

git push

cd $source

if [ ! -d $source/www.cemosis.fr ]; then
    git clone ssh://git@github.com/cemosis/www.cemosis.fr.git $source/www.cemosis.fr
fi

cd $source/www.cemosis.fr

git pull origin master

git subtree pull --prefix=_posts $giturl master --squash

git push

cd $source

if [ ! -d $source/www.feelpp.org ]; then
    git clone ssh://git@github.com/feelpp/www.feelpp.org.git $source/www.feelpp.org
fi

cd $source/www.feelpp.org

git pull origin master

git subtree pull --prefix=_posts $giturl master --squash

git push
