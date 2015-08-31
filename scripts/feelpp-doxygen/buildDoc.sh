#!/bin/bash
set -e
#set -x

# This script is meant to be run automatically
# as part of the jekyll-hook application.
# https://github.com/developmentseed/jekyll-hook

repo=$1
branch=$2
owner=$3
giturl=$4
source=$5
build=$6

echo branch = $branch

# Check to see if repo exists. If not, git clone it
if [ ! -d $source ]; then
  git clone $giturl $source
fi

# Git checkout appropriate branch, pull latest code
cd $source
git checkout $branch
git pull origin $branch

if [ ! -d $build ]; then
  mkdir $build
  cd $build
  cmake $source -DCMAKE_CXX_COMPILER=/usr/bin/clang++-3.6 -DFEELPP_ENABLE_DOXYGEN=ON -DFEELPP_ENABLE_BENCHMARKS=OFF -DFEELPP_ENABLE_TESTS=OFF -DFEELPP_ENABLE_RESEARCH=OFF -DFEELPP_ENABLE_APPLICATIONS=OFF -DFEELPP_ENABLE_DOCUMENTATION=OFF -DFEELPP_ENABLE_INSTANTIATION_MODE=OFF
fi;
cd $build
make doxygen

# Set the path of the hosted site
site="/var/www/doc.feelpp.org/html/$branch"

if [ ! -d $site ]; then
    mkdir -p $site
fi


rsync -az $build/doc/api/html $site 