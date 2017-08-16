package RT::Extension::LifecycleUI;
use strict;
use warnings;

our $VERSION = '0.01';

=head1 NAME

RT-Extension-LifecycleUI - manage lifecycles via admin UI

=head1 INSTALLATION

=over

=item Install L<RT::Extension::ConfigInDatabase>

=item perl Makefile.PL

=item make

=item make install

This step may require root permissions.

=item Edit your /opt/rt4/etc/RT_SiteConfig.pm

Add this line:

    Plugin( "RT::Extension::LifecycleUI" );

=item Clear your mason cache

    rm -rf /opt/rt4/var/mason_data/obj

=item Restart your webserver

=back

=head1 AUTHOR

Best Practical Solutions, LLC E<lt>modules@bestpractical.comE<gt>

=head1 BUGS

All bugs should be reported via email to

    L<bug-RT-Extension-LifecycleUI@rt.cpan.org|mailto:bug-RT-Extension-LifecycleUI@rt.cpan.org>

or via the web at

    L<rt.cpan.org|http://rt.cpan.org/Public/Dist/Display.html?Name=RT-Extension-LifecycleUI>.

=head1 COPYRIGHT

This extension is Copyright (C) 2017 Best Practical Solutions, LLC.

This is free software, licensed under:

  The GNU General Public License, Version 2, June 1991

=cut

1;
