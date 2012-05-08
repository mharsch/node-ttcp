#ttcp.js

A Node.js port of [the venerable ttcp](http://en.wikipedia.org/wiki/Ttcp)
network performance tool by Mike Muuss and Terry Slattery.  A subset of the
original options have been ported.  As it stands, ttcp.js is capable of
measuring throughput of TCP and UDP connections using a generated pattern
(known as source/sink mode).  Due to the very simple nature of the tool,
ttcp.js is largely compatible with the original C version (modulo any features
that were not ported or do not have node environment equivalents).

##Example:

	$(recv_host) ./ttcp.js -r
	ttcp-r: buflen=8192, port=5001  tcp
	ttcp-r: socket
	<<< waits for connection >>>

	$(trans_host) ./ttcp -t -n 1000000 recv_host
	ttcp-t: buflen=8192, nbuf=100000, port=5001  tcp  -> recv_host
	ttcp-t: socket
	ttcp-t: connect
	ttcp-t: 781.3MB in 7.341 seconds = 106.4MB/sec +++

##Usage:

ttcp.js can run in either transmit (-t) or receive (-r) mode.  Run ttcp.js with
no arguments to see usage details:

	$ ./ttcp.js 
	Options:
	  -t, --transmit   Transmit mode                                           [boolean]
	  -r, --receive    Receive mode                                            [boolean]
	  -u, --udp        Use UDP instead of TCP                                  [boolean]  [default: false]
	  -p, --port       Port number to send to or listen on                     [default: 5001]
	  -l, --buflen     size of buffers to be written-to / read-from socket     [default: 8192]
	  -n, --nbuf       number of buffers to be written to the socket           [default: 2097152]
	  -f, --format     report throughput in terms of either "bytes" or "bits"  [default: "bytes"]
	  -D, --nodelay    set TCP_NODELAY socket option                           [boolean]  [default: false]
	  -T, --touchdata  touch received data as it is read                       [boolean]  [default: false]

##Installation:

To install, just run 'npm install ttcp'.  A symlink to ttcp.js called 'ttcp'
will be placed in ~node_modules/.bin (if installed locally) or in npm's
global bin directory (if installed with -g).
