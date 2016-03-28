use AnyEvent;
use AnyEvent::IRC::Client;


    my $log_chan = '#mojo';
    my $timer; 
    my $c = AnyEvent->condvar;
    my $con = new AnyEvent::IRC::Client;

    $con->reg_cb( join => sub {
        my ($con, $nick, $channel, $is_myself) = @_; 
        if ($is_myself && $channel eq $log_chan) {
           $con->send_chan( $channel, PRIVMSG => ($channel, 'my information') );
           $timer = AnyEvent->timer ( 
                after => 1,
                cb => sub {
                    undef $timer;
                    $con->disconnect('done');
                });
        }
    });

    $con->connect("irc.hackthissite.org", 6667, { nick => "testMojo" } );
    $con->send_srv( JOIN => ($log_chan) );
    $c->wait;
    $con->disconnect;