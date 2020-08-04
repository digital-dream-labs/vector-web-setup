* Fixed usage string to reflect use of packaged node.js app rather
  than source checkout execution.
  
* Fix for an issue where some computer network settings explicitly
  require binding to 0.0.0.0 to expose the web app to Vector robots
  and added an option to override the 0.0.0.0 IP for users with unique
  network configuration.

* Users can now specify the TCP/IP port to run the app on to avoid conflicts
  with existing applications that use port 8000.

* We now issue a graceful error message when the program attempts to
  bind to a TCP/IP port in use by another process.

* Fixed documentation error that used the incorrect command for
  `vector-web-setup ota-approve`.

1.0.0
=====

* Initial public release.