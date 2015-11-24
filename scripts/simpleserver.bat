@echo off
title Simpleserver

node %~dp0..\node_modules\http-server\bin\http-server %~dp0\.. -p 9999 %*
