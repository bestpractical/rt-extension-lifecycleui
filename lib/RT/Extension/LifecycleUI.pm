package RT::Extension::LifecycleUI;
use strict;
use warnings;
use Storable;

our $VERSION = '0.01';

RT->AddStyleSheets("lifecycleui.css");

$RT::Config::META{Lifecycles}{EditLink} = RT->Config->Get('WebURL') . 'Admin/Lifecycles/';
$RT::Config::META{Lifecycles}{EditLinkLabel} = "lifecycles administration";

sub _CreateLifecycle {
    my $class = shift;
    my %args  = @_;
    my $CurrentUser = $args{CurrentUser};

    my $lifecycles = RT->Config->Get('Lifecycles');
    my $lifecycle;

    if ($args{Clone}) {
        $lifecycle = Storable::dclone($lifecycles->{ $args{Clone} });
    }
    else {
        $lifecycle = { type => $args{Type} };
    }

    $lifecycles->{$args{Name}} = $lifecycle;

    my $setting = RT::DatabaseSetting->new($CurrentUser);
    $setting->Load('Lifecycles');
    if ($setting->Id) {
        my ($ok, $msg) = $setting->SetContent($lifecycles);
        return ($ok, $msg) if !$ok;
    }
    else {
        my ($ok, $msg) = $setting->Create(
            Name    => 'Lifecycles',
            Content => $lifecycles,
        );
        return ($ok, $msg) if !$ok;
    }

    RT::Lifecycle->FillCache;

    return (1, $CurrentUser->loc("Lifecycle created"));
}

sub CreateLifecycle {
    my $class = shift;
    my %args = (
        CurrentUser => undef,
        Name        => undef,
        Type        => undef,
        Clone       => undef,
        @_,
    );

    my $CurrentUser = $args{CurrentUser};
    my $Name = $args{Name};
    my $Type = $args{Type};
    my $Clone = $args{Clone};

    return (0, $CurrentUser->loc("Lifecycle Name required"))
        unless length $Name;

    return (0, $CurrentUser->loc("Lifecycle Type required"))
        unless length $Type;

    return (0, $CurrentUser->loc("Invalid lifecycle type '[_1]'", $Type))
            unless $RT::Lifecycle::LIFECYCLES_TYPES{$Type};

    if (length $Clone) {
        return (0, $CurrentUser->loc("Invalid '[_1]' lifecycle '[_2]'", $Type, $Clone))
            unless grep { $_ eq $Clone } RT::Lifecycle->ListAll($Type);
    }

    return (0, $CurrentUser->loc("'[_1]' lifecycle '[_2]' already exists", $Type, $Name))
        if grep { $_ eq $Name } RT::Lifecycle->ListAll($Type);

    return $class->_CreateLifecycle(%args);
}

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
